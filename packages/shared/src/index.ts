export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface TimeRange {
  startTime: string;
  endTime: string;
}

export interface WeeklyAvailabilityRule extends TimeRange {
  weekday: Weekday;
}
