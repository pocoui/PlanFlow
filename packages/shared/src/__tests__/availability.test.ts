import { describe, expect, it } from "vitest";

import {
  validateWeeklyAvailability,
  type WeeklyAvailabilityRuleInput
} from "../availability";

describe("validateWeeklyAvailability", () => {
  it("accepts one valid weekly time range", () => {
    const result = validateWeeklyAvailability([
      { weekday: 1, startTime: "09:00", endTime: "11:00" }
    ]);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts multiple non-overlapping ranges on the same day", () => {
    const result = validateWeeklyAvailability([
      { weekday: 6, startTime: "09:00", endTime: "12:00" },
      { weekday: 6, startTime: "14:00", endTime: "16:00" }
    ]);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts rules when some weekdays have no time ranges", () => {
    const result = validateWeeklyAvailability([
      { weekday: 2, startTime: "19:30", endTime: "21:00" }
    ]);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects an empty weekly availability", () => {
    const result = validateWeeklyAvailability([]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "availability.empty",
      message: "At least one weekly availability range is required."
    });
  });

  it("rejects an invalid weekday value", () => {
    const result = validateWeeklyAvailability([
      { weekday: 7, startTime: "09:00", endTime: "11:00" }
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "weekday.invalid",
      message: "Weekday must be an integer between 0 and 6.",
      index: 0,
      field: "weekday"
    });
  });

  it("rejects a range whose end time is earlier than its start time", () => {
    const result = validateWeeklyAvailability([
      { weekday: 3, startTime: "18:00", endTime: "17:00" }
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "timeRange.order",
      message: "End time must be later than start time.",
      index: 0,
      field: "endTime"
    });
  });

  it("rejects a range whose end time equals its start time", () => {
    const result = validateWeeklyAvailability([
      { weekday: 3, startTime: "18:00", endTime: "18:00" }
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "timeRange.order",
      message: "End time must be later than start time.",
      index: 0,
      field: "endTime"
    });
  });

  it("rejects overlapping time ranges on the same weekday", () => {
    const result = validateWeeklyAvailability([
      { weekday: 6, startTime: "09:00", endTime: "12:00" },
      { weekday: 6, startTime: "11:30", endTime: "13:00" }
    ]);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "timeRange.overlap",
      message: "Availability ranges on the same weekday must not overlap.",
      index: 1,
      field: "startTime",
      conflictIndex: 0
    });
  });

  it("allows adjacent time ranges on the same weekday", () => {
    const result = validateWeeklyAvailability([
      { weekday: 0, startTime: "09:00", endTime: "10:00" },
      { weekday: 0, startTime: "10:00", endTime: "11:00" }
    ] satisfies WeeklyAvailabilityRuleInput[]);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
