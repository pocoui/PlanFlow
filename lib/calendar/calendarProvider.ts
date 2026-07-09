import type { BusySlot, DateTimeRange } from "@/packages/shared/src/availability-engine";

export type GetBusySlotsInput = DateTimeRange;

export interface CreateCalendarEventInput extends DateTimeRange {
  title: string;
  description?: string;
}

export interface UpdateCalendarEventInput extends CreateCalendarEventInput {
  externalEventId: string;
}

export interface ExternalCalendarEvent extends DateTimeRange {
  externalEventId: string;
  title: string;
  description?: string;
}

export interface DeleteCalendarEventInput {
  externalEventId: string;
}

export interface CalendarProvider {
  getBusySlots(input: GetBusySlotsInput): Promise<BusySlot[]>;
  createCalendarEvent(
    input: CreateCalendarEventInput
  ): Promise<ExternalCalendarEvent>;
  updateCalendarEvent(
    input: UpdateCalendarEventInput
  ): Promise<ExternalCalendarEvent>;
  deleteCalendarEvent(input: DeleteCalendarEventInput): Promise<void>;
}
