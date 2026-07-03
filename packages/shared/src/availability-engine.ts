import {
  parseTimeToMinutes,
  type Weekday,
  type WeeklyAvailabilityRule
} from "./availability";

export type { Weekday, WeeklyAvailabilityRule } from "./availability";

export interface DateTimeRange {
  startAt: Date;
  endAt: Date;
}

export interface BusySlot extends DateTimeRange {
  id: string;
  source: "mock_feishu" | "feishu" | string;
  title: string;
  externalEventId?: string;
}

export interface RealAvailabilitySlot extends DateTimeRange {
  weekday: Weekday;
}

export interface CalculateRealAvailabilityInput {
  weeklyAvailability: WeeklyAvailabilityRule[];
  busySlots: BusySlot[];
  startAt: Date;
  endAt: Date;
  bufferMinutes?: number;
}

interface CandidateAvailabilitySlot extends RealAvailabilitySlot {
  startMs: number;
  endMs: number;
}

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export function calculateRealAvailability({
  weeklyAvailability,
  busySlots,
  startAt,
  endAt,
  bufferMinutes = 0
}: CalculateRealAvailabilityInput): RealAvailabilitySlot[] {
  if (endAt <= startAt) {
    return [];
  }

  const candidates = buildCandidateAvailabilitySlots(
    weeklyAvailability,
    startAt,
    endAt
  );
  const bufferedBusySlots = busySlots
    .map((slot) => ({
      startMs: slot.startAt.getTime(),
      endMs: slot.endAt.getTime() + bufferMinutes * MINUTE_MS
    }))
    .filter((slot) => slot.endMs > slot.startMs)
    .sort((a, b) => a.startMs - b.startMs);

  return candidates.flatMap((candidate) =>
    subtractBusySlots(candidate, bufferedBusySlots)
  );
}

function buildCandidateAvailabilitySlots(
  weeklyAvailability: WeeklyAvailabilityRule[],
  startAt: Date,
  endAt: Date
): CandidateAvailabilitySlot[] {
  const rulesByWeekday = new Map<Weekday, WeeklyAvailabilityRule[]>();

  weeklyAvailability.forEach((rule) => {
    const rules = rulesByWeekday.get(rule.weekday) ?? [];
    rules.push(rule);
    rulesByWeekday.set(rule.weekday, rules);
  });

  const startOfFirstDay = startOfUtcDay(startAt);
  const endMs = endAt.getTime();
  const slots: CandidateAvailabilitySlot[] = [];

  for (
    let dayMs = startOfFirstDay.getTime();
    dayMs <= endMs;
    dayMs += DAY_MS
  ) {
    const day = new Date(dayMs);
    const weekday = day.getUTCDay() as Weekday;
    const rules = rulesByWeekday.get(weekday) ?? [];

    rules.forEach((rule) => {
      const startMinutes = parseTimeToMinutes(rule.startTime);
      const endMinutes = parseTimeToMinutes(rule.endTime);

      if (startMinutes === null || endMinutes === null) {
        return;
      }

      const slotStartMs = dayMs + startMinutes * MINUTE_MS;
      const slotEndMs = dayMs + endMinutes * MINUTE_MS;
      const clippedStartMs = Math.max(slotStartMs, startAt.getTime());
      const clippedEndMs = Math.min(slotEndMs, endAt.getTime());

      if (clippedEndMs <= clippedStartMs) {
        return;
      }

      slots.push({
        weekday,
        startAt: new Date(clippedStartMs),
        endAt: new Date(clippedEndMs),
        startMs: clippedStartMs,
        endMs: clippedEndMs
      });
    });
  }

  return slots.sort((a, b) => a.startMs - b.startMs);
}

function subtractBusySlots(
  availability: CandidateAvailabilitySlot,
  busySlots: Array<{ startMs: number; endMs: number }>
): RealAvailabilitySlot[] {
  let segments = [
    {
      startMs: availability.startMs,
      endMs: availability.endMs
    }
  ];

  busySlots.forEach((busySlot) => {
    segments = segments.flatMap((segment) => {
      if (
        busySlot.endMs <= segment.startMs ||
        busySlot.startMs >= segment.endMs
      ) {
        return [segment];
      }

      const nextSegments: Array<{ startMs: number; endMs: number }> = [];
      const beforeEndMs = Math.min(busySlot.startMs, segment.endMs);
      const afterStartMs = Math.max(busySlot.endMs, segment.startMs);

      if (beforeEndMs > segment.startMs) {
        nextSegments.push({
          startMs: segment.startMs,
          endMs: beforeEndMs
        });
      }

      if (segment.endMs > afterStartMs) {
        nextSegments.push({
          startMs: afterStartMs,
          endMs: segment.endMs
        });
      }

      return nextSegments;
    });
  });

  return segments.map((segment) => ({
    weekday: availability.weekday,
    startAt: new Date(segment.startMs),
    endAt: new Date(segment.endMs)
  }));
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
}
