import { prisma } from "../db/prisma";
import { MockFeishuCalendarProvider } from "../calendar/mockFeishuCalendarProvider";
import type { CalendarProvider } from "../calendar/calendarProvider";
import { generateLearningTasks } from "./aiPlanningService";
import type { GeneratedLearningTask } from "./aiPlanningService";
import {
  calculateRealAvailability,
  validateWeeklyAvailability
} from "@planflow/shared";
import type {
  BusySlot,
  Weekday,
  WeeklyAvailabilityRule,
  WeeklyAvailabilityRuleInput
} from "@planflow/shared";
import { scheduleTasks } from "@planflow/scheduler";
import type {
  ScheduledSession,
  SchedulerWarning
} from "@planflow/scheduler";

export type PlanStatus = "draft" | "generated" | "archived";
export type TaskStatus = "not_started" | "in_progress" | "completed" | "delayed";
export type SessionStatus =
  | "scheduled"
  | "completed"
  | "missed"
  | "rescheduled"
  | "conflicted";

export interface CreatePlanInput {
  title: string;
  goal: string;
  totalMinutes: number;
  startDate: string;
  deadline: string;
  rescheduleBufferMinutes?: number;
  availability: WeeklyAvailabilityRuleInput[];
}

export interface PlanRecord {
  id: string;
  userId: string;
  title: string;
  goal: string;
  totalMinutes: number;
  startDate: Date;
  deadline: Date;
  rescheduleBufferMinutes: number;
  status: PlanStatus;
  createdAt: Date;
  updatedAt: Date;
  availability: AvailabilityRuleRecord[];
  tasks: LearningTaskRecord[];
  sessions: ScheduledSessionRecord[];
  busySlots: BusySlotRecord[];
}

export interface AvailabilityRuleRecord extends WeeklyAvailabilityRule {
  id: string;
  planId: string;
}

export interface LearningTaskRecord extends GeneratedLearningTask {
  planId: string;
  status: TaskStatus;
}

export interface ScheduledSessionRecord extends Omit<ScheduledSession, "status"> {
  id: string;
  planId: string;
  status: SessionStatus;
}

export interface BusySlotRecord extends BusySlot {
  planId: string;
}

export interface GeneratePlanResult {
  planId: string;
  tasks: LearningTaskRecord[];
  sessions: ScheduledSessionRecord[];
  busySlots: BusySlotRecord[];
  warnings: SchedulerWarning[];
}

export interface PlanDetails extends PlanRecord {
  progress: {
    totalTasks: number;
    completedTasks: number;
    totalSessions: number;
    completedSessions: number;
  };
}

export interface PlanRepository {
  createPlan(input: CreatePlanRepositoryInput): Promise<PlanRecord>;
  getPlan(planId: string): Promise<PlanRecord | null>;
  savePlanGeneration(input: SavePlanGenerationInput): Promise<GeneratePlanResult>;
}

export interface PlanServiceDependencies {
  repository?: PlanRepository;
  calendarProvider?: CalendarProvider;
}

interface CreatePlanRepositoryInput
  extends Omit<PlanRecord, "id" | "createdAt" | "updatedAt" | "availability" | "tasks" | "sessions" | "busySlots"> {
  availability: WeeklyAvailabilityRule[];
}

interface SavePlanGenerationInput {
  planId: string;
  tasks: GeneratedLearningTask[];
  sessions: ScheduledSession[];
  busySlots: BusySlot[];
  warnings: SchedulerWarning[];
}

const MOCK_USER_ID = "mock-user";
let idCounter = 0;

export async function createPlan(
  input: CreatePlanInput,
  dependencies: PlanServiceDependencies = {}
): Promise<PlanRecord> {
  const normalized = normalizeCreatePlanInput(input);
  const repository = dependencies.repository ?? createPrismaPlanRepository();

  return repository.createPlan({
    userId: MOCK_USER_ID,
    title: normalized.title,
    goal: normalized.goal,
    totalMinutes: normalized.totalMinutes,
    startDate: normalized.startDate,
    deadline: normalized.deadline,
    rescheduleBufferMinutes: normalized.rescheduleBufferMinutes,
    status: "draft",
    availability: normalized.availability
  });
}

export async function generatePlan(
  planId: string,
  dependencies: PlanServiceDependencies = {}
): Promise<GeneratePlanResult> {
  const repository = dependencies.repository ?? createPrismaPlanRepository();
  const calendarProvider =
    dependencies.calendarProvider ?? new MockFeishuCalendarProvider();
  const plan = await requirePlan(planId, repository);
  const tasks = await generateLearningTasks({
    title: plan.title,
    goal: plan.goal,
    totalMinutes: plan.totalMinutes
  });
  const busySlots = await calendarProvider.getBusySlots({
    startAt: plan.startDate,
    endAt: endOfUtcDay(plan.deadline)
  });
  const realAvailability = calculateRealAvailability({
    weeklyAvailability: plan.availability,
    busySlots,
    startAt: plan.startDate,
    endAt: endOfUtcDay(plan.deadline),
    bufferMinutes: plan.rescheduleBufferMinutes
  });
  const scheduled = scheduleTasks({
    tasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      estimatedMinutes: task.estimatedMinutes,
      priority: task.priority
    })),
    availabilitySlots: realAvailability
  });

  return repository.savePlanGeneration({
    planId,
    tasks,
    sessions: scheduled.sessions,
    busySlots,
    warnings: scheduled.warnings
  });
}

export async function getPlan(
  planId: string,
  dependencies: PlanServiceDependencies = {}
): Promise<PlanDetails> {
  const repository = dependencies.repository ?? createPrismaPlanRepository();
  const plan = await requirePlan(planId, repository);

  return {
    ...plan,
    progress: {
      totalTasks: plan.tasks.length,
      completedTasks: plan.tasks.filter((task) => task.status === "completed").length,
      totalSessions: plan.sessions.length,
      completedSessions: plan.sessions.filter(
        (session) => session.status === "completed"
      ).length
    }
  };
}

export function createInMemoryPlanRepository(): PlanRepository {
  const plans = new Map<string, PlanRecord>();

  return {
    async createPlan(input) {
      const now = new Date("2026-07-04T00:00:00.000Z");
      const planId = nextId("plan");
      const plan: PlanRecord = {
        ...input,
        id: planId,
        createdAt: now,
        updatedAt: now,
        availability: input.availability.map((rule) => ({
          ...rule,
          id: nextId("availability"),
          planId
        })),
        tasks: [],
        sessions: [],
        busySlots: []
      };
      plans.set(planId, clonePlan(plan));

      return clonePlan(plan);
    },
    async getPlan(planId) {
      const plan = plans.get(planId);

      return plan ? clonePlan(plan) : null;
    },
    async savePlanGeneration(input) {
      const plan = plans.get(input.planId);

      if (!plan) {
        throw new PlanServiceError("NOT_FOUND", "Plan not found.");
      }

      const tasks = input.tasks.map((task) => ({
        ...task,
        id: task.id,
        planId: input.planId,
        status: "not_started" as TaskStatus
      }));
      const sessions = input.sessions.map((session) => ({
        ...session,
        id: nextId("session"),
        planId: input.planId,
        status: session.status
      }));
      const busySlots = input.busySlots.map((slot) => ({
        ...slot,
        id: slot.id,
        planId: input.planId
      }));

      plan.status = "generated";
      plan.tasks = tasks;
      plan.sessions = sessions;
      plan.busySlots = busySlots;
      plan.updatedAt = new Date("2026-07-04T00:00:00.000Z");
      plans.set(input.planId, clonePlan(plan));

      return {
        planId: input.planId,
        tasks,
        sessions,
        busySlots,
        warnings: input.warnings
      };
    }
  };
}

export function createPrismaPlanRepository(): PlanRepository {
  return {
    async createPlan(input) {
      await prisma.user.upsert({
        where: { id: input.userId },
        update: {},
        create: {
          id: input.userId,
          email: "mock@planflow.local",
          name: "Mock User"
        }
      });

      const plan = await prisma.learningPlan.create({
        data: {
          userId: input.userId,
          title: input.title,
          goal: input.goal,
          totalMinutes: input.totalMinutes,
          startDate: input.startDate,
          deadline: input.deadline,
          rescheduleBufferMinutes: input.rescheduleBufferMinutes,
          status: input.status,
          availability: {
            create: input.availability.map((rule) => ({
              weekday: rule.weekday,
              startTime: rule.startTime,
              endTime: rule.endTime
            }))
          }
        },
        include: planInclude
      });

      return mapPrismaPlan(plan);
    },
    async getPlan(planId) {
      const plan = await prisma.learningPlan.findUnique({
        where: { id: planId },
        include: planInclude
      });

      return plan ? mapPrismaPlan(plan) : null;
    },
    async savePlanGeneration(input) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.learningTask.deleteMany({ where: { planId: input.planId } });
        await tx.scheduledSession.deleteMany({ where: { planId: input.planId } });
        await tx.busySlot.deleteMany({ where: { planId: input.planId } });

        const tasks = await Promise.all(
          input.tasks.map((task) =>
            tx.learningTask.create({
              data: {
                id: task.id,
                planId: input.planId,
                phase: task.phase,
                title: task.title,
                description: task.description,
                estimatedMinutes: task.estimatedMinutes,
                priority: task.priority,
                acceptanceCriteria: task.acceptanceCriteria,
                orderIndex: task.orderIndex
              }
            })
          )
        );
        const sessions = await Promise.all(
          input.sessions.map((session) =>
            tx.scheduledSession.create({
              data: {
                planId: input.planId,
                taskId: session.taskId,
                startAt: session.startAt,
                endAt: session.endAt,
                durationMinutes: session.durationMinutes,
                status: session.status
              }
            })
          )
        );
        const busySlots = await Promise.all(
          input.busySlots.map((slot) =>
            tx.busySlot.create({
              data: {
                id: slot.id,
                planId: input.planId,
                source: slot.source,
                externalEventId: slot.externalEventId,
                title: slot.title,
                startAt: slot.startAt,
                endAt: slot.endAt
              }
            })
          )
        );

        await tx.learningPlan.update({
          where: { id: input.planId },
          data: { status: "generated" }
        });

        return { tasks, sessions, busySlots };
      });

      return {
        planId: input.planId,
        tasks: result.tasks.map(mapPrismaTask),
        sessions: result.sessions.map(mapPrismaSession),
        busySlots: result.busySlots.map(mapPrismaBusySlot),
        warnings: input.warnings
      };
    }
  };
}

export class PlanServiceError extends Error {
  constructor(
    public readonly code: "VALIDATION_ERROR" | "NOT_FOUND",
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

function normalizeCreatePlanInput(input: CreatePlanInput) {
  const startDate = parseDate(input.startDate);
  const deadline = parseDate(input.deadline);
  const totalMinutes = Number(input.totalMinutes);
  const rescheduleBufferMinutes = input.rescheduleBufferMinutes ?? 15;
  const availabilityValidation = validateWeeklyAvailability(input.availability);

  if (input.title.trim().length === 0 || input.goal.trim().length === 0) {
    throw new PlanServiceError(
      "VALIDATION_ERROR",
      "Title and goal are required."
    );
  }

  if (!Number.isInteger(totalMinutes) || totalMinutes <= 0) {
    throw new PlanServiceError(
      "VALIDATION_ERROR",
      "totalMinutes must be greater than 0."
    );
  }

  if (deadline <= startDate) {
    throw new PlanServiceError(
      "VALIDATION_ERROR",
      "deadline must be later than startDate."
    );
  }

  if (
    !Number.isInteger(rescheduleBufferMinutes) ||
    rescheduleBufferMinutes < 0
  ) {
    throw new PlanServiceError(
      "VALIDATION_ERROR",
      "rescheduleBufferMinutes must be greater than or equal to 0."
    );
  }

  if (!availabilityValidation.valid) {
    throw new PlanServiceError(
      "VALIDATION_ERROR",
      "availability is invalid.",
      availabilityValidation.errors
    );
  }

  return {
    title: input.title.trim(),
    goal: input.goal.trim(),
    totalMinutes,
    startDate,
    deadline,
    rescheduleBufferMinutes,
    availability: input.availability.map((rule) => ({
      ...rule,
      weekday: rule.weekday as Weekday
    }))
  };
}

function parseDate(value: string): Date {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new PlanServiceError("VALIDATION_ERROR", "Invalid date.");
  }

  return parsed;
}

async function requirePlan(
  planId: string,
  repository: PlanRepository
): Promise<PlanRecord> {
  const plan = await repository.getPlan(planId);

  if (!plan) {
    throw new PlanServiceError("NOT_FOUND", "Plan not found.");
  }

  return plan;
}

function endOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999)
  );
}

function nextId(prefix: string): string {
  idCounter += 1;

  return `${prefix}_${idCounter}`;
}

function clonePlan(plan: PlanRecord): PlanRecord {
  return {
    ...plan,
    startDate: new Date(plan.startDate),
    deadline: new Date(plan.deadline),
    createdAt: new Date(plan.createdAt),
    updatedAt: new Date(plan.updatedAt),
    availability: plan.availability.map((rule) => ({ ...rule })),
    tasks: plan.tasks.map((task) => ({
      ...task,
      acceptanceCriteria: [...task.acceptanceCriteria]
    })),
    sessions: plan.sessions.map((session) => ({
      ...session,
      startAt: new Date(session.startAt),
      endAt: new Date(session.endAt)
    })),
    busySlots: plan.busySlots.map((slot) => ({
      ...slot,
      startAt: new Date(slot.startAt),
      endAt: new Date(slot.endAt)
    }))
  };
}

const planInclude = {
  availability: true,
  tasks: true,
  sessions: true,
  busySlots: true
} as const;

interface PrismaPlanShape {
  id: string;
  userId: string;
  title: string;
  goal: string;
  totalMinutes: number;
  startDate: Date;
  deadline: Date;
  rescheduleBufferMinutes: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  availability: Array<{
    id: string;
    planId: string;
    weekday: number;
    startTime: string;
    endTime: string;
  }>;
  tasks: Array<{
    id: string;
    planId: string;
    phase: string;
    title: string;
    description: string;
    estimatedMinutes: number;
    priority: number;
    status: string;
    acceptanceCriteria: unknown;
    orderIndex: number;
  }>;
  sessions: Array<{
    id: string;
    planId: string;
    taskId: string;
    startAt: Date;
    endAt: Date;
    durationMinutes: number;
    status: string;
  }>;
  busySlots: Array<{
    id: string;
    planId: string;
    source: string;
    externalEventId: string | null;
    title: string;
    startAt: Date;
    endAt: Date;
  }>;
}

function mapPrismaPlan(plan: PrismaPlanShape): PlanRecord {
  return {
    id: plan.id,
    userId: plan.userId,
    title: plan.title,
    goal: plan.goal,
    totalMinutes: plan.totalMinutes,
    startDate: plan.startDate,
    deadline: plan.deadline,
    rescheduleBufferMinutes: plan.rescheduleBufferMinutes,
    status: plan.status as PlanStatus,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    availability: plan.availability.map((rule) => ({
      ...rule,
      weekday: rule.weekday as Weekday
    })),
    tasks: plan.tasks.map(mapPrismaTask),
    sessions: plan.sessions.map(mapPrismaSession),
    busySlots: plan.busySlots.map(mapPrismaBusySlot)
  };
}

function mapPrismaTask(task: {
  id: string;
  planId: string;
  phase: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  priority: number;
  status: string;
  acceptanceCriteria: unknown;
  orderIndex: number;
}): LearningTaskRecord {
  return {
    id: task.id,
    planId: task.planId,
    phase: task.phase,
    title: task.title,
    description: task.description,
    estimatedMinutes: task.estimatedMinutes,
    priority: task.priority,
    status: task.status as TaskStatus,
    acceptanceCriteria: Array.isArray(task.acceptanceCriteria)
      ? task.acceptanceCriteria.filter((item): item is string => typeof item === "string")
      : [],
    orderIndex: task.orderIndex
  };
}

function mapPrismaSession(session: {
  id: string;
  planId: string;
  taskId: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  status: string;
}): ScheduledSessionRecord {
  return {
    id: session.id,
    planId: session.planId,
    taskId: session.taskId,
    startAt: session.startAt,
    endAt: session.endAt,
    durationMinutes: session.durationMinutes,
    status: session.status as SessionStatus
  };
}

function mapPrismaBusySlot(slot: {
  id: string;
  planId: string;
  source: string;
  externalEventId: string | null;
  title: string;
  startAt: Date;
  endAt: Date;
}): BusySlotRecord {
  return {
    id: slot.id,
    planId: slot.planId,
    source: slot.source,
    externalEventId: slot.externalEventId ?? undefined,
    title: slot.title,
    startAt: slot.startAt,
    endAt: slot.endAt
  };
}
