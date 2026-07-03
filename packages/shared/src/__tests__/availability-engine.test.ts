import { describe, expect, it } from "vitest";

import { calculateRealAvailability } from "../availability-engine";
import type { BusySlot, WeeklyAvailabilityRule } from "../availability-engine";

describe("calculateRealAvailability", () => {
  const mondayMorning: WeeklyAvailabilityRule[] = [
    { weekday: 1, startTime: "09:00", endTime: "12:00" }
  ];

  const monday = {
    startAt: new Date("2026-07-06T00:00:00.000Z"),
    endAt: new Date("2026-07-06T23:59:59.999Z")
  };

  it("subtracts busy slots from weekly availability", () => {
    const result = calculateRealAvailability({
      weeklyAvailability: mondayMorning,
      busySlots: [
        busy("meeting-1", "2026-07-06T09:30:00.000Z", "2026-07-06T10:00:00.000Z")
      ],
      ...monday
    });

    expect(toIsoRanges(result)).toEqual([
      ["2026-07-06T09:00:00.000Z", "2026-07-06T09:30:00.000Z"],
      ["2026-07-06T10:00:00.000Z", "2026-07-06T12:00:00.000Z"]
    ]);
  });

  it("removes availability when a busy slot fully covers it", () => {
    const result = calculateRealAvailability({
      weeklyAvailability: mondayMorning,
      busySlots: [
        busy("meeting-1", "2026-07-06T08:30:00.000Z", "2026-07-06T12:30:00.000Z")
      ],
      ...monday
    });

    expect(result).toEqual([]);
  });

  it("splits availability when a meeting sits in the middle", () => {
    const result = calculateRealAvailability({
      weeklyAvailability: mondayMorning,
      busySlots: [
        busy("meeting-1", "2026-07-06T10:00:00.000Z", "2026-07-06T11:00:00.000Z")
      ],
      ...monday
    });

    expect(toIsoRanges(result)).toEqual([
      ["2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z"],
      ["2026-07-06T11:00:00.000Z", "2026-07-06T12:00:00.000Z"]
    ]);
  });

  it("applies buffer minutes after a busy slot ends", () => {
    const result = calculateRealAvailability({
      weeklyAvailability: mondayMorning,
      busySlots: [
        busy("meeting-1", "2026-07-06T10:00:00.000Z", "2026-07-06T11:00:00.000Z")
      ],
      bufferMinutes: 15,
      ...monday
    });

    expect(toIsoRanges(result)).toEqual([
      ["2026-07-06T09:00:00.000Z", "2026-07-06T10:00:00.000Z"],
      ["2026-07-06T11:15:00.000Z", "2026-07-06T12:00:00.000Z"]
    ]);
  });

  it("keeps availability unchanged when busy slots do not intersect", () => {
    const result = calculateRealAvailability({
      weeklyAvailability: mondayMorning,
      busySlots: [
        busy("meeting-1", "2026-07-06T13:00:00.000Z", "2026-07-06T14:00:00.000Z")
      ],
      bufferMinutes: 15,
      ...monday
    });

    expect(toIsoRanges(result)).toEqual([
      ["2026-07-06T09:00:00.000Z", "2026-07-06T12:00:00.000Z"]
    ]);
  });
});

function busy(id: string, startAt: string, endAt: string): BusySlot {
  return {
    id,
    source: "mock_feishu",
    title: "Mock meeting",
    startAt: new Date(startAt),
    endAt: new Date(endAt)
  };
}

function toIsoRanges(slots: Array<{ startAt: Date; endAt: Date }>) {
  return slots.map((slot) => [slot.startAt.toISOString(), slot.endAt.toISOString()]);
}
