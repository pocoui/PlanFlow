import { Prisma } from "@prisma/client";

import { prisma } from "../db/prisma";
import { buildIcsCalendar } from "../calendar/calendarExportService";
import { MockFeishuCalendarProvider } from "../calendar/mockFeishuCalendarProvider";
import type { CalendarProvider } from "../calendar/calendarProvider";
import {
  rescheduleReviewedSession,
  type ReviewResult,
  type SessionReviewInput
} from "../review/reviewEngine";
import {
  generateLearningTasks,
  createProviderFromConfig
} from "./aiPlanningService";
import type {
  GeneratedLearningTask,
  GeneratedTaskValidationWarning
} from "./aiPlanningService";
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

export interface GeneratePlanTasksResult {
  planId: string;
  tasks: LearningTaskRecord[];
  warnings: GeneratedTaskValidationWarning[];
}

export interface PlanDetails extends PlanRecord {
  progress: {
    totalTasks: number;
    completedTasks: number;
    totalSessions: number;
    completedSessions: number;
  };
}

export interface SessionReviewRecord extends SessionReviewInput {
  id: string;
  sessionId: string;
  taskId: string;
  createdAt: Date;
}

export interface SubmitSessionReviewResult {
  reviewId: string;
  sessionId: string;
  taskId: string;
  rescheduledSessions: ScheduledSessionRecord[];
  warnings: SchedulerWarning[];
}

export interface BusySlotsForPlanResult {
  provider: "mock_feishu";
  busySlots: BusySlotRecord[];
}

export interface PlanRepository {
  createPlan(input: CreatePlanRepositoryInput): Promise<PlanRecord>;
  getPlan(planId: string): Promise<PlanRecord | null>;
  listPlans(): Promise<PlanRecord[]>;
  deletePlan(planId: string): Promise<void>;
  savePlanGeneration(input: SavePlanGenerationInput): Promise<GeneratePlanResult>;
  savePlanTasks(input: SavePlanTasksInput): Promise<LearningTaskRecord[]>;
  savePlanSchedule(input: SavePlanScheduleInput): Promise<GeneratePlanResult>;
  updateTaskStatus(taskId: string, status: TaskStatus): Promise<LearningTaskRecord>;
  updateSessionStatus(
    sessionId: string,
    status: SessionStatus
  ): Promise<ScheduledSessionRecord>;
  getSessionContext(sessionId: string): Promise<SessionReviewContext | null>;
  saveSessionReview(input: SaveSessionReviewInput): Promise<SubmitSessionReviewResult>;
}

export interface PlanServiceDependencies {
  repository?: PlanRepository;
  calendarProvider?: CalendarProvider;
  aiConfig?: {
    provider: "mock" | "openai_compatible";
    openai: {
      baseUrl: string;
      model: string;
      apiKey: string;
    };
  };
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

interface SavePlanTasksInput {
  planId: string;
  tasks: GeneratedLearningTask[];
  warnings: GeneratedTaskValidationWarning[];
}

interface SavePlanScheduleInput {
  planId: string;
  sessions: ScheduledSession[];
  busySlots: BusySlot[];
  warnings: SchedulerWarning[];
}

interface SessionReviewContext {
  plan: PlanRecord;
  session: ScheduledSessionRecord;
  task: LearningTaskRecord;
}

interface SaveSessionReviewInput {
  planId: string;
  sessionId: string;
  taskId: string;
  review: NormalizedSessionReviewInput;
  originalSessionStatus: SessionStatus;
  rescheduledSessions: ScheduledSession[];
  warnings: SchedulerWarning[];
}

interface NormalizedSessionReviewInput extends SessionReviewInput {
  result: ReviewResult;
  actualMinutes: number;
  remainingMinutes: number;
  continueTask: boolean;
}

const MOCK_USER_ID = "mock-user";
const globalForIdCounter = globalThis as unknown as {
  __planflowIdCounter?: number;
};

let idCounter: number = globalForIdCounter.__planflowIdCounter ?? 0;

function persistIdCounter(): void {
  globalForIdCounter.__planflowIdCounter = idCounter;
}

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
  await generatePlanTasks(planId, dependencies);

  return schedulePlan(planId, dependencies);
}

export async function generatePlanTasks(
  planId: string,
  dependencies: PlanServiceDependencies = {}
): Promise<GeneratePlanTasksResult> {
  const repository = dependencies.repository ?? createPrismaPlanRepository();
  console.log("[planService.generatePlanTasks] 查询计划 planId:", planId);
  const plan = await requirePlan(planId, repository);
  console.log("[planService.generatePlanTasks] 计划已找到 title:", plan.title, "totalMinutes:", plan.totalMinutes);

  const provider = dependencies.aiConfig
    ? createProviderFromConfig(dependencies.aiConfig)
    : undefined;
  console.log("[planService.generatePlanTasks] Provider:", provider?.constructor.name ?? "default MockAiPlanningProvider");

  const generation = await generateLearningTasks({
    title: plan.title,
    goal: plan.goal,
    totalMinutes: plan.totalMinutes
  }, provider);
  console.log("[planService.generatePlanTasks] AI 生成完成 tasks:", generation.tasks.length, "warnings:", generation.warnings.length);

  const tasks = await repository.savePlanTasks({
    planId,
    tasks: generation.tasks,
    warnings: generation.warnings
  });
  console.log("[planService.generatePlanTasks] 保存完成 tasks:", tasks.length);

  return {
    planId,
    tasks,
    warnings: generation.warnings
  };
}

export async function schedulePlan(
  planId: string,
  dependencies: PlanServiceDependencies = {}
): Promise<GeneratePlanResult> {
  const repository = dependencies.repository ?? createPrismaPlanRepository();
  const calendarProvider =
    dependencies.calendarProvider ?? new MockFeishuCalendarProvider();
  const plan = await requirePlan(planId, repository);

  if (plan.tasks.length === 0) {
    throw new PlanServiceError(
      "CONFLICT",
      "Plan has no tasks to schedule. Generate tasks first."
    );
  }

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
    tasks: plan.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      estimatedMinutes: task.estimatedMinutes,
      priority: task.priority
    })),
    availabilitySlots: realAvailability
  });

  return repository.savePlanSchedule({
    planId,
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

export async function deletePlan(
  planId: string,
  dependencies: PlanServiceDependencies = {}
): Promise<void> {
  const repository = dependencies.repository ?? createPrismaPlanRepository();
  await requirePlan(planId, repository);
  await repository.deletePlan(planId);
}

export async function updateTaskStatus(
  taskId: string,
  status: string,
  dependencies: PlanServiceDependencies = {}
): Promise<LearningTaskRecord> {
  const repository = dependencies.repository ?? createPrismaPlanRepository();
  const normalizedStatus = parseTaskStatus(status);

  return repository.updateTaskStatus(taskId, normalizedStatus);
}

export async function updateSessionStatus(
  sessionId: string,
  status: string,
  dependencies: PlanServiceDependencies = {}
): Promise<ScheduledSessionRecord> {
  const repository = dependencies.repository ?? createPrismaPlanRepository();
  const normalizedStatus = parseSessionStatus(status);

  return repository.updateSessionStatus(sessionId, normalizedStatus);
}

export async function submitSessionReview(
  sessionId: string,
  input: SessionReviewInput,
  dependencies: PlanServiceDependencies = {}
): Promise<SubmitSessionReviewResult> {
  const repository = dependencies.repository ?? createPrismaPlanRepository();
  const calendarProvider =
    dependencies.calendarProvider ?? new MockFeishuCalendarProvider();
  const context = await repository.getSessionContext(sessionId);

  if (!context) {
    throw new PlanServiceError("NOT_FOUND", "Session not found.");
  }

  const review = normalizeSessionReviewInput(input, context.session.durationMinutes);
  const busySlots = await calendarProvider.getBusySlots({
    startAt: context.session.endAt,
    endAt: endOfUtcDay(context.plan.deadline)
  });
  const availabilitySlots = calculateRealAvailability({
    weeklyAvailability: context.plan.availability,
    busySlots,
    startAt: context.session.endAt,
    endAt: endOfUtcDay(context.plan.deadline),
    bufferMinutes: context.plan.rescheduleBufferMinutes
  });
  const rescheduled = rescheduleReviewedSession({
    session: {
      id: context.session.id,
      taskId: context.session.taskId,
      taskTitle: context.task.title,
      startAt: context.session.startAt,
      endAt: context.session.endAt,
      durationMinutes: context.session.durationMinutes
    },
    review,
    availabilitySlots,
    bufferMinutes: context.plan.rescheduleBufferMinutes
  });

  return repository.saveSessionReview({
    planId: context.plan.id,
    sessionId,
    taskId: context.task.id,
    review,
    originalSessionStatus:
      review.result === "completed" ? "completed" : "rescheduled",
    rescheduledSessions: rescheduled.sessions,
    warnings: rescheduled.warnings
  });
}

export async function getBusySlotsForPlan(
  planId: string,
  input: { start: string; end: string },
  dependencies: PlanServiceDependencies = {}
): Promise<BusySlotsForPlanResult> {
  const repository = dependencies.repository ?? createPrismaPlanRepository();
  const calendarProvider =
    dependencies.calendarProvider ?? new MockFeishuCalendarProvider();
  await requirePlan(planId, repository);
  const startAt = parseDate(input.start);
  const endAt = endOfUtcDay(parseDate(input.end));

  if (endAt <= startAt) {
    throw new PlanServiceError(
      "VALIDATION_ERROR",
      "end must be later than start."
    );
  }

  const busySlots = await calendarProvider.getBusySlots({ startAt, endAt });

  return {
    provider: "mock_feishu",
    busySlots: busySlots.map((slot) => ({
      ...slot,
      planId
    }))
  };
}

export async function exportPlanCalendarIcs(
  planId: string,
  dependencies: PlanServiceDependencies = {}
): Promise<string> {
  const repository = dependencies.repository ?? createPrismaPlanRepository();
  const plan = await requirePlan(planId, repository);
  const exportableSessions = plan.sessions.filter(
    (session) => session.status === "scheduled" || session.status === "completed"
  );

  if (exportableSessions.length === 0) {
    throw new PlanServiceError(
      "CONFLICT",
      "Plan has no scheduled sessions to export."
    );
  }

  return buildIcsCalendar(plan, exportableSessions);
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
    async listPlans() {
      return Array.from(plans.values()).map(clonePlan);
    },
    async deletePlan(planId) {
      if (!plans.has(planId)) {
        throw new PlanServiceError("NOT_FOUND", "Plan not found.");
      }
      plans.delete(planId);
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
    },
    async savePlanTasks(input) {
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

      plan.tasks = tasks;
      plan.sessions = [];
      plan.busySlots = [];
      plan.updatedAt = new Date("2026-07-04T00:00:00.000Z");
      plans.set(input.planId, clonePlan(plan));

      return tasks.map((task) => ({ ...task, acceptanceCriteria: [...task.acceptanceCriteria] }));
    },
    async savePlanSchedule(input) {
      const plan = plans.get(input.planId);

      if (!plan) {
        throw new PlanServiceError("NOT_FOUND", "Plan not found.");
      }

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
      plan.sessions = sessions;
      plan.busySlots = busySlots;
      plan.updatedAt = new Date("2026-07-04T00:00:00.000Z");
      plans.set(input.planId, clonePlan(plan));

      return {
        planId: input.planId,
        tasks: plan.tasks.map((task) => ({
          ...task,
          acceptanceCriteria: [...task.acceptanceCriteria]
        })),
        sessions,
        busySlots,
        warnings: input.warnings
      };
    },
    async updateTaskStatus(taskId, status) {
      for (const plan of plans.values()) {
        const task = plan.tasks.find((item) => item.id === taskId);

        if (task) {
          task.status = status;
          plan.updatedAt = new Date("2026-07-04T00:00:00.000Z");
          plans.set(plan.id, clonePlan(plan));

          return { ...task, acceptanceCriteria: [...task.acceptanceCriteria] };
        }
      }

      throw new PlanServiceError("NOT_FOUND", "Task not found.");
    },
    async updateSessionStatus(sessionId, status) {
      for (const plan of plans.values()) {
        const session = plan.sessions.find((item) => item.id === sessionId);

        if (session) {
          session.status = status;
          plan.updatedAt = new Date("2026-07-04T00:00:00.000Z");
          plans.set(plan.id, clonePlan(plan));

          return copySession(session);
        }
      }

      throw new PlanServiceError("NOT_FOUND", "Session not found.");
    },
    async getSessionContext(sessionId) {
      for (const plan of plans.values()) {
        const session = plan.sessions.find((item) => item.id === sessionId);

        if (!session) {
          continue;
        }

        const task = plan.tasks.find((item) => item.id === session.taskId);

        if (!task) {
          return null;
        }

        return {
          plan: clonePlan(plan),
          session: copySession(session),
          task: { ...task, acceptanceCriteria: [...task.acceptanceCriteria] }
        };
      }

      return null;
    },
    async saveSessionReview(input) {
      const plan = plans.get(input.planId);

      if (!plan) {
        throw new PlanServiceError("NOT_FOUND", "Plan not found.");
      }

      const session = plan.sessions.find((item) => item.id === input.sessionId);

      if (!session) {
        throw new PlanServiceError("NOT_FOUND", "Session not found.");
      }

      session.status = input.originalSessionStatus;
      const rescheduledSessions = input.rescheduledSessions.map((item) => ({
        ...item,
        id: nextId("session"),
        planId: input.planId,
        status: item.status
      }));
      plan.sessions.push(...rescheduledSessions);
      plan.updatedAt = new Date("2026-07-04T00:00:00.000Z");
      plans.set(input.planId, clonePlan(plan));

      return {
        reviewId: nextId("review"),
        sessionId: input.sessionId,
        taskId: input.taskId,
        rescheduledSessions: rescheduledSessions.map(copySession),
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
    async listPlans() {
      const plans = await prisma.learningPlan.findMany({
        include: planInclude,
        orderBy: { createdAt: "desc" }
      });

      return plans.map(mapPrismaPlan);
    },
    async deletePlan(planId) {
      try {
        await prisma.learningPlan.delete({ where: { id: planId } });
      } catch (error) {
        throwNotFoundForMissingRecord(error, "Plan not found.");
        throw error;
      }
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
    },
    async savePlanTasks(input) {
      console.log("[PrismaRepo.savePlanTasks] 开始保存 planId:", input.planId, "tasks:", input.tasks.length);
      const result = await prisma.$transaction(async (tx) => {
        const deletedTasks = await tx.learningTask.deleteMany({ where: { planId: input.planId } });
        console.log("[PrismaRepo.savePlanTasks] 已清理旧 tasks:", deletedTasks.count);

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
        console.log("[PrismaRepo.savePlanTasks] 已写入新 tasks:", tasks.length);

        return { tasks };
      });

      console.log("[PrismaRepo.savePlanTasks] 事务完成，返回 tasks:", result.tasks.length);
      return result.tasks.map(mapPrismaTask);
    },
    async savePlanSchedule(input) {
      const plan = await prisma.learningPlan.findUnique({
        where: { id: input.planId },
        include: planInclude
      });

      if (!plan) {
        throw new PlanServiceError("NOT_FOUND", "Plan not found.");
      }

      const result = await prisma.$transaction(async (tx) => {
        await tx.scheduledSession.deleteMany({ where: { planId: input.planId } });
        await tx.busySlot.deleteMany({ where: { planId: input.planId } });

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

        return { sessions, busySlots };
      });

      return {
        planId: input.planId,
        tasks: plan.tasks.map(mapPrismaTask),
        sessions: result.sessions.map(mapPrismaSession),
        busySlots: result.busySlots.map(mapPrismaBusySlot),
        warnings: input.warnings
      };
    },
    async updateTaskStatus(taskId, status) {
      try {
        const task = await prisma.learningTask.update({
          where: { id: taskId },
          data: { status }
        });

        return mapPrismaTask(task);
      } catch (error) {
        throwNotFoundForMissingRecord(error, "Task not found.");
        throw error;
      }
    },
    async updateSessionStatus(sessionId, status) {
      try {
        const session = await prisma.scheduledSession.update({
          where: { id: sessionId },
          data: { status }
        });

        return mapPrismaSession(session);
      } catch (error) {
        throwNotFoundForMissingRecord(error, "Session not found.");
        throw error;
      }
    },
    async getSessionContext(sessionId) {
      const session = await prisma.scheduledSession.findUnique({
        where: { id: sessionId },
        include: {
          task: true,
          plan: {
            include: planInclude
          }
        }
      });

      if (!session) {
        return null;
      }

      return {
        plan: mapPrismaPlan(session.plan),
        session: mapPrismaSession(session),
        task: mapPrismaTask(session.task)
      };
    },
    async saveSessionReview(input) {
      const result = await prisma.$transaction(async (tx) => {
        await tx.scheduledSession.update({
          where: { id: input.sessionId },
          data: { status: input.originalSessionStatus }
        });
        const review = await tx.sessionReview.upsert({
          where: { sessionId: input.sessionId },
          update: {
            result: input.review.result,
            actualMinutes: input.review.actualMinutes,
            remainingMinutes: input.review.remainingMinutes,
            reason: input.review.reason,
            continueTask: input.review.continueTask
          },
          create: {
            sessionId: input.sessionId,
            taskId: input.taskId,
            result: input.review.result,
            actualMinutes: input.review.actualMinutes,
            remainingMinutes: input.review.remainingMinutes,
            reason: input.review.reason,
            continueTask: input.review.continueTask
          }
        });
        const rescheduledSessions = await Promise.all(
          input.rescheduledSessions.map((session) =>
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

        return { review, rescheduledSessions };
      });

      return {
        reviewId: result.review.id,
        sessionId: input.sessionId,
        taskId: input.taskId,
        rescheduledSessions: result.rescheduledSessions.map(mapPrismaSession),
        warnings: input.warnings
      };
    }
  };
}

export class PlanServiceError extends Error {
  constructor(
    public readonly code: "VALIDATION_ERROR" | "NOT_FOUND" | "CONFLICT",
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
  }
}

function throwNotFoundForMissingRecord(error: unknown, message: string): void {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2025"
  ) {
    throw new PlanServiceError("NOT_FOUND", message);
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

function parseTaskStatus(status: string): TaskStatus {
  const allowed: TaskStatus[] = [
    "not_started",
    "in_progress",
    "completed",
    "delayed"
  ];

  if (!allowed.includes(status as TaskStatus)) {
    throw new PlanServiceError(
      "VALIDATION_ERROR",
      "Invalid task status.",
      { allowed }
    );
  }

  return status as TaskStatus;
}

function parseSessionStatus(status: string): SessionStatus {
  const allowed: SessionStatus[] = [
    "scheduled",
    "completed",
    "missed",
    "rescheduled",
    "conflicted"
  ];

  if (!allowed.includes(status as SessionStatus)) {
    throw new PlanServiceError(
      "VALIDATION_ERROR",
      "Invalid session status.",
      { allowed }
    );
  }

  return status as SessionStatus;
}

function normalizeSessionReviewInput(
  input: SessionReviewInput,
  sessionMinutes: number
): NormalizedSessionReviewInput {
  const allowed: ReviewResult[] = [
    "completed",
    "partial",
    "not_completed",
    "skipped"
  ];

  if (!allowed.includes(input.result)) {
    throw new PlanServiceError(
      "VALIDATION_ERROR",
      "Invalid review result.",
      { allowed }
    );
  }

  if (!Number.isInteger(input.actualMinutes) || input.actualMinutes < 0) {
    throw new PlanServiceError(
      "VALIDATION_ERROR",
      "actualMinutes must be greater than or equal to 0."
    );
  }

  const remainingMinutes =
    input.result === "completed"
      ? 0
      : input.result === "partial"
        ? input.remainingMinutes ?? 0
        : sessionMinutes;

  if (!Number.isInteger(remainingMinutes) || remainingMinutes < 0) {
    throw new PlanServiceError(
      "VALIDATION_ERROR",
      "remainingMinutes must be greater than or equal to 0."
    );
  }

  return {
    result: input.result,
    actualMinutes: input.actualMinutes,
    remainingMinutes,
    reason: input.reason,
    continueTask: input.continueTask ?? true
  };
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
  persistIdCounter();

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

function copySession(session: ScheduledSessionRecord): ScheduledSessionRecord {
  return {
    ...session,
    startAt: new Date(session.startAt),
    endAt: new Date(session.endAt)
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
