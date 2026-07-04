import {
  scheduleTasks,
  type ScheduledSession,
  type SchedulerWarning
} from "@planflow/scheduler";
import type { RealAvailabilitySlot } from "@planflow/shared";

export type ReviewResult = "completed" | "partial" | "not_completed" | "skipped";

export interface ReviewableSession {
  id: string;
  taskId: string;
  taskTitle: string;
  startAt: Date;
  endAt: Date;
  durationMinutes: number;
}

export interface SessionReviewInput {
  result: ReviewResult;
  actualMinutes: number;
  remainingMinutes?: number;
  reason?: string;
  continueTask: boolean;
}

export interface PendingReviewTask {
  taskId: string;
  title: string;
  minutesToSchedule: number;
  reason?: string;
}

export interface RescheduleReviewedSessionInput {
  session: ReviewableSession;
  review: SessionReviewInput;
  availabilitySlots: RealAvailabilitySlot[];
  bufferMinutes?: number;
}

export interface RescheduleReviewedSessionResult {
  pendingTask: PendingReviewTask | null;
  sessions: ScheduledSession[];
  warnings: SchedulerWarning[];
}

const MINUTE_MS = 60 * 1000;

export function rescheduleReviewedSession({
  session,
  review,
  availabilitySlots,
  bufferMinutes = 0
}: RescheduleReviewedSessionInput): RescheduleReviewedSessionResult {
  const minutesToSchedule = getMinutesToSchedule(session, review);

  if (minutesToSchedule === 0) {
    return {
      pendingTask: null,
      sessions: [],
      warnings: []
    };
  }

  const pendingTask: PendingReviewTask = {
    taskId: session.taskId,
    title: session.taskTitle,
    minutesToSchedule,
    reason: review.reason
  };
  const earliestStartAt = new Date(
    session.endAt.getTime() + bufferMinutes * MINUTE_MS
  );
  const futureAvailability = clipAvailabilityAfter(
    availabilitySlots,
    earliestStartAt
  );
  const scheduled = scheduleTasks({
    tasks: [
      {
        id: session.taskId,
        title: session.taskTitle,
        estimatedMinutes: minutesToSchedule
      }
    ],
    availabilitySlots: futureAvailability
  });

  return {
    pendingTask,
    sessions: scheduled.sessions,
    warnings: scheduled.warnings
  };
}

function getMinutesToSchedule(
  session: ReviewableSession,
  review: SessionReviewInput
): number {
  if (review.result === "completed") {
    return 0;
  }

  if (review.result === "partial") {
    return Math.max(0, review.remainingMinutes ?? 0);
  }

  return session.durationMinutes;
}

function clipAvailabilityAfter(
  availabilitySlots: RealAvailabilitySlot[],
  earliestStartAt: Date
): RealAvailabilitySlot[] {
  const earliestStartMs = earliestStartAt.getTime();

  return availabilitySlots
    .map((slot) => {
      const startMs = Math.max(slot.startAt.getTime(), earliestStartMs);
      const endMs = slot.endAt.getTime();

      return {
        weekday: slot.weekday,
        startAt: new Date(startMs),
        endAt: new Date(endMs)
      };
    })
    .filter((slot) => slot.endAt > slot.startAt);
}
