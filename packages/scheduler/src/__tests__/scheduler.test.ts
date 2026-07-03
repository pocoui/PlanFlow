import { describe, expect, it } from "vitest";

import { scheduleTasks } from "../scheduler";
import type { LearningTaskForSchedule, RealAvailabilitySlot } from "../scheduler";

describe("scheduleTasks", () => {
  it("schedules tasks only inside real availability", () => {
    const result = scheduleTasks({
      tasks: [task("task-1", 60)],
      availabilitySlots: [slot("2026-07-06T09:00:00.000Z", "2026-07-06T11:00:00.000Z")]
    });

    expect(toSessionRanges(result.sessions)).toEqual([
      ["task-1", "2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z", 60]
    ]);
    expect(result.unscheduledTasks).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("skips disabled weekdays by using only provided real availability", () => {
    const result = scheduleTasks({
      tasks: [task("task-1", 60)],
      availabilitySlots: [slot("2026-07-07T09:00:00.000Z", "2026-07-07T10:00:00.000Z")]
    });

    expect(toSessionRanges(result.sessions)).toEqual([
      ["task-1", "2026-07-07T09:00:00.000Z", "2026-07-07T10:00:00.000Z", 60]
    ]);
  });

  it("uses multiple availability slots on the same day", () => {
    const result = scheduleTasks({
      tasks: [task("task-1", 120)],
      availabilitySlots: [
        slot("2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z"),
        slot("2026-07-06T14:00:00.000Z", "2026-07-06T15:00:00.000Z")
      ]
    });

    expect(toSessionRanges(result.sessions)).toEqual([
      ["task-1", "2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z", 60],
      ["task-1", "2026-07-06T14:00:00.000Z", "2026-07-06T15:00:00.000Z", 60]
    ]);
  });

  it("does not schedule into gaps removed for busy time", () => {
    const result = scheduleTasks({
      tasks: [task("task-1", 90)],
      availabilitySlots: [
        slot("2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z"),
        slot("2026-07-06T11:15:00.000Z", "2026-07-06T12:00:00.000Z")
      ]
    });

    expect(toSessionRanges(result.sessions)).toEqual([
      ["task-1", "2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z", 60],
      ["task-1", "2026-07-06T11:15:00.000Z", "2026-07-06T11:45:00.000Z", 30]
    ]);
  });

  it("splits a long task across multiple schedule blocks", () => {
    const result = scheduleTasks({
      tasks: [task("task-1", 150)],
      availabilitySlots: [
        slot("2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z"),
        slot("2026-07-07T09:00:00.000Z", "2026-07-07T10:30:00.000Z")
      ]
    });

    expect(toSessionRanges(result.sessions)).toEqual([
      ["task-1", "2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z", 60],
      ["task-1", "2026-07-07T09:00:00.000Z", "2026-07-07T10:30:00.000Z", 90]
    ]);
  });

  it("returns unscheduled minutes when availability is insufficient", () => {
    const result = scheduleTasks({
      tasks: [task("task-1", 90)],
      availabilitySlots: [slot("2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z")]
    });

    expect(toSessionRanges(result.sessions)).toEqual([
      ["task-1", "2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z", 60]
    ]);
    expect(result.unscheduledTasks).toEqual([
      {
        taskId: "task-1",
        remainingMinutes: 30
      }
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

  it("uses the earliest available slots and produces deterministic output", () => {
    const input = {
      tasks: [task("task-1", 30), task("task-2", 30)],
      availabilitySlots: [
        slot("2026-07-07T09:00:00.000Z", "2026-07-07T10:00:00.000Z"),
        slot("2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z")
      ]
    };

    const first = scheduleTasks(input);
    const second = scheduleTasks(input);

    expect(toSessionRanges(first.sessions)).toEqual([
      ["task-1", "2026-07-06T09:00:00.000Z", "2026-07-06T09:30:00.000Z", 30],
      ["task-2", "2026-07-06T09:30:00.000Z", "2026-07-06T10:00:00.000Z", 30]
    ]);
    expect(first).toEqual(second);
  });
});

function task(id: string, estimatedMinutes: number): LearningTaskForSchedule {
  return {
    id,
    title: id,
    estimatedMinutes
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
