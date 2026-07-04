import { describe, expect, it } from "vitest";

import { rescheduleReviewedSession } from "../reviewEngine";
import type { ReviewableSession, SessionReviewInput } from "../reviewEngine";
import type { RealAvailabilitySlot } from "@planflow/shared";

describe("rescheduleReviewedSession", () => {
  const originalSession: ReviewableSession = {
    id: "session-1",
    taskId: "task-1",
    taskTitle: "Learn hooks",
    startAt: new Date("2026-07-06T09:00:00.000Z"),
    endAt: new Date("2026-07-06T10:00:00.000Z"),
    durationMinutes: 60
  };

  it("does not create rescheduled sessions for a completed review", () => {
    const result = rescheduleReviewedSession({
      session: originalSession,
      review: review({ result: "completed", actualMinutes: 60 }),
      availabilitySlots: [slot("2026-07-06T10:30:00.000Z", "2026-07-06T11:30:00.000Z")]
    });

    expect(result.sessions).toEqual([]);
    expect(result.pendingTask).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it("reschedules remaining minutes after a partial review", () => {
    const result = rescheduleReviewedSession({
      session: originalSession,
      review: review({
        result: "partial",
        actualMinutes: 20,
        remainingMinutes: 40
      }),
      availabilitySlots: [slot("2026-07-06T10:30:00.000Z", "2026-07-06T11:30:00.000Z")]
    });

    expect(result.pendingTask).toEqual({
      taskId: "task-1",
      title: "Learn hooks",
      minutesToSchedule: 40,
      reason: undefined
    });
    expect(toSessionRanges(result.sessions)).toEqual([
      ["task-1", "2026-07-06T10:30:00.000Z", "2026-07-06T11:10:00.000Z", 40]
    ]);
  });

  it("reschedules the original session duration after a not-completed review", () => {
    const result = rescheduleReviewedSession({
      session: originalSession,
      review: review({
        result: "not_completed",
        actualMinutes: 0,
        reason: "Unexpected interruption"
      }),
      availabilitySlots: [slot("2026-07-06T10:30:00.000Z", "2026-07-06T12:00:00.000Z")]
    });

    expect(result.pendingTask).toEqual({
      taskId: "task-1",
      title: "Learn hooks",
      minutesToSchedule: 60,
      reason: "Unexpected interruption"
    });
    expect(toSessionRanges(result.sessions)).toEqual([
      ["task-1", "2026-07-06T10:30:00.000Z", "2026-07-06T11:30:00.000Z", 60]
    ]);
  });

  it("applies custom buffer minutes before rescheduling", () => {
    const result = rescheduleReviewedSession({
      session: originalSession,
      review: review({
        result: "partial",
        actualMinutes: 30,
        remainingMinutes: 30
      }),
      availabilitySlots: [slot("2026-07-06T10:00:00.000Z", "2026-07-06T11:00:00.000Z")],
      bufferMinutes: 15
    });

    expect(toSessionRanges(result.sessions)).toEqual([
      ["task-1", "2026-07-06T10:15:00.000Z", "2026-07-06T10:45:00.000Z", 30]
    ]);
  });

  it("returns a warning when capacity before deadline is insufficient", () => {
    const result = rescheduleReviewedSession({
      session: originalSession,
      review: review({
        result: "partial",
        actualMinutes: 0,
        remainingMinutes: 90
      }),
      availabilitySlots: [slot("2026-07-06T10:30:00.000Z", "2026-07-06T11:30:00.000Z")]
    });

    expect(toSessionRanges(result.sessions)).toEqual([
      ["task-1", "2026-07-06T10:30:00.000Z", "2026-07-06T11:30:00.000Z", 60]
    ]);
    expect(result.warnings).toEqual([
      {
        code: "capacity.insufficient",
        message: "Not enough availability to schedule every task.",
        taskId: "task-1",
        remainingMinutes: 30
      }
    ]);
  });

  it("records skipped reviews as pending work with the skip reason", () => {
    const result = rescheduleReviewedSession({
      session: originalSession,
      review: review({
        result: "skipped",
        actualMinutes: 0,
        reason: "Too tired"
      }),
      availabilitySlots: [slot("2026-07-06T10:30:00.000Z", "2026-07-06T11:30:00.000Z")]
    });

    expect(result.pendingTask).toEqual({
      taskId: "task-1",
      title: "Learn hooks",
      minutesToSchedule: 60,
      reason: "Too tired"
    });
  });
});

function review(overrides: Partial<SessionReviewInput>): SessionReviewInput {
  return {
    result: "completed",
    actualMinutes: 60,
    continueTask: true,
    ...overrides
  };
}

function slot(startAt: string, endAt: string): RealAvailabilitySlot {
  return {
    weekday: new Date(startAt).getUTCDay() as RealAvailabilitySlot["weekday"],
    startAt: new Date(startAt),
    endAt: new Date(endAt)
  };
}

function toSessionRanges(
  sessions: Array<{
    taskId: string;
    startAt: Date;
    endAt: Date;
    durationMinutes: number;
  }>
) {
  return sessions.map((session) => [
    session.taskId,
    session.startAt.toISOString(),
    session.endAt.toISOString(),
    session.durationMinutes
  ]);
}
