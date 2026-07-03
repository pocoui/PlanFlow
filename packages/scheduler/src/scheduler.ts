import type { RealAvailabilitySlot } from "@planflow/shared";

export type { RealAvailabilitySlot } from "@planflow/shared";

export interface LearningTaskForSchedule {
  id: string;
  title: string;
  estimatedMinutes: number;
  priority?: number;
}

export interface ScheduledSession {
  taskId: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
  status: "scheduled";
}

export interface UnscheduledTask {
  taskId: string;
  remainingMinutes: number;
}

export interface SchedulerWarning {
  code: "capacity.insufficient";
  message: string;
  taskId: string;
  remainingMinutes: number;
}

export interface ScheduleTasksInput {
  tasks: LearningTaskForSchedule[];
  availabilitySlots: RealAvailabilitySlot[];
}

export interface ScheduleTasksResult {
  sessions: ScheduledSession[];
  unscheduledTasks: UnscheduledTask[];
  warnings: SchedulerWarning[];
}

interface MutableAvailabilityCursor {
  startMs: number;
  endMs: number;
}

const MINUTE_MS = 60 * 1000;

export function scheduleTasks({
  tasks,
  availabilitySlots
}: ScheduleTasksInput): ScheduleTasksResult {
  const availability = availabilitySlots
    .map((slot) => ({
      startMs: slot.startAt.getTime(),
      endMs: slot.endAt.getTime()
    }))
    .filter((slot) => slot.endMs > slot.startMs)
    .sort((a, b) => {
      if (a.startMs !== b.startMs) {
        return a.startMs - b.startMs;
      }

      return a.endMs - b.endMs;
    });

  const sessions: ScheduledSession[] = [];
  const unscheduledTasks: UnscheduledTask[] = [];
  const warnings: SchedulerWarning[] = [];
  let availabilityIndex = 0;

  tasks.forEach((task) => {
    let remainingMinutes = task.estimatedMinutes;

    while (remainingMinutes > 0 && availabilityIndex < availability.length) {
      const currentSlot = availability[availabilityIndex];
      const slotMinutes = getAvailableMinutes(currentSlot);

      if (slotMinutes <= 0) {
        availabilityIndex += 1;
        continue;
      }

      const scheduledMinutes = Math.min(remainingMinutes, slotMinutes);
      const sessionStartMs = currentSlot.startMs;
      const sessionEndMs = sessionStartMs + scheduledMinutes * MINUTE_MS;

      sessions.push({
        taskId: task.id,
        startAt: new Date(sessionStartMs),
        endAt: new Date(sessionEndMs),
        durationMinutes: scheduledMinutes,
        status: "scheduled"
      });

      currentSlot.startMs = sessionEndMs;
      remainingMinutes -= scheduledMinutes;

      if (currentSlot.startMs >= currentSlot.endMs) {
        availabilityIndex += 1;
      }
    }

    if (remainingMinutes > 0) {
      unscheduledTasks.push({
        taskId: task.id,
        remainingMinutes
      });
      warnings.push({
        code: "capacity.insufficient",
        message: "Not enough availability to schedule every task.",
        taskId: task.id,
        remainingMinutes
      });
    }
  });

  return {
    sessions,
    unscheduledTasks,
    warnings
  };
}

function getAvailableMinutes(slot: MutableAvailabilityCursor): number {
  return Math.floor((slot.endMs - slot.startMs) / MINUTE_MS);
}
