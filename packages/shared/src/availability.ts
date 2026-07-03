export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type AvailabilityValidationErrorCode =
  | "availability.empty"
  | "weekday.invalid"
  | "time.invalid"
  | "timeRange.order"
  | "timeRange.overlap";

export interface WeeklyAvailabilityRuleInput {
  weekday: number;
  startTime: string;
  endTime: string;
}

export interface WeeklyAvailabilityRule {
  weekday: Weekday;
  startTime: string;
  endTime: string;
}

export interface AvailabilityValidationError {
  code: AvailabilityValidationErrorCode;
  message: string;
  index?: number;
  field?: keyof WeeklyAvailabilityRuleInput;
  conflictIndex?: number;
}

export interface AvailabilityValidationResult {
  valid: boolean;
  errors: AvailabilityValidationError[];
}

interface ParsedAvailabilityRule extends WeeklyAvailabilityRule {
  index: number;
  startMinutes: number;
  endMinutes: number;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 0 && value <= 6;
}

export function parseTimeToMinutes(value: string): number | null {
  const match = TIME_PATTERN.exec(value);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours * 60 + minutes;
}

export function validateWeeklyAvailability(
  rules: WeeklyAvailabilityRuleInput[]
): AvailabilityValidationResult {
  const errors: AvailabilityValidationError[] = [];
  const parsedRules: ParsedAvailabilityRule[] = [];

  if (rules.length === 0) {
    errors.push({
      code: "availability.empty",
      message: "At least one weekly availability range is required."
    });
  }

  rules.forEach((rule, index) => {
    const startMinutes = parseTimeToMinutes(rule.startTime);
    const endMinutes = parseTimeToMinutes(rule.endTime);

    if (!isValidWeekday(rule.weekday)) {
      errors.push({
        code: "weekday.invalid",
        message: "Weekday must be an integer between 0 and 6.",
        index,
        field: "weekday"
      });
    }

    if (startMinutes === null) {
      errors.push({
        code: "time.invalid",
        message: "Time must use HH:mm in 24-hour format.",
        index,
        field: "startTime"
      });
    }

    if (endMinutes === null) {
      errors.push({
        code: "time.invalid",
        message: "Time must use HH:mm in 24-hour format.",
        index,
        field: "endTime"
      });
    }

    if (startMinutes === null || endMinutes === null) {
      return;
    }

    if (endMinutes <= startMinutes) {
      errors.push({
        code: "timeRange.order",
        message: "End time must be later than start time.",
        index,
        field: "endTime"
      });

      return;
    }

    if (!isValidWeekday(rule.weekday)) {
      return;
    }

    parsedRules.push({
      ...rule,
      weekday: rule.weekday,
      index,
      startMinutes,
      endMinutes
    });
  });

  findOverlaps(parsedRules).forEach((error) => errors.push(error));

  return {
    valid: errors.length === 0,
    errors
  };
}

function findOverlaps(
  rules: ParsedAvailabilityRule[]
): AvailabilityValidationError[] {
  const errors: AvailabilityValidationError[] = [];
  const rulesByWeekday = new Map<Weekday, ParsedAvailabilityRule[]>();

  rules.forEach((rule) => {
    const weekdayRules = rulesByWeekday.get(rule.weekday) ?? [];
    weekdayRules.push(rule);
    rulesByWeekday.set(rule.weekday, weekdayRules);
  });

  rulesByWeekday.forEach((weekdayRules) => {
    const sortedRules = [...weekdayRules].sort((a, b) => {
      if (a.startMinutes !== b.startMinutes) {
        return a.startMinutes - b.startMinutes;
      }

      return a.endMinutes - b.endMinutes;
    });

    for (let i = 1; i < sortedRules.length; i += 1) {
      const previous = sortedRules[i - 1];
      const current = sortedRules[i];

      if (current.startMinutes < previous.endMinutes) {
        errors.push({
          code: "timeRange.overlap",
          message: "Availability ranges on the same weekday must not overlap.",
          index: current.index,
          field: "startTime",
          conflictIndex: previous.index
        });
      }
    }
  });

  return errors;
}
