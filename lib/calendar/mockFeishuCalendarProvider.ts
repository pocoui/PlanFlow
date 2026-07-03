import type { BusySlot } from "@/packages/shared/src/availability-engine";

import type {
  CalendarProvider,
  CreateCalendarEventInput,
  ExternalCalendarEvent,
  GetBusySlotsInput,
  UpdateCalendarEventInput
} from "./calendarProvider";

export class MockFeishuCalendarProvider implements CalendarProvider {
  private readonly busySlots: BusySlot[];

  constructor(busySlots: BusySlot[] = defaultMockBusySlots()) {
    this.busySlots = busySlots;
  }

  async getBusySlots(input: GetBusySlotsInput): Promise<BusySlot[]> {
    return this.busySlots
      .filter((slot) => rangesOverlap(slot, input))
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
      .map(copyBusySlot);
  }

  async createCalendarEvent(
    input: CreateCalendarEventInput
  ): Promise<ExternalCalendarEvent> {
    return {
      externalEventId: `mock_feishu_${input.startAt.getTime()}`,
      title: input.title,
      description: input.description,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt)
    };
  }

  async updateCalendarEvent(
    input: UpdateCalendarEventInput
  ): Promise<ExternalCalendarEvent> {
    return {
      externalEventId: input.externalEventId,
      title: input.title,
      description: input.description,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt)
    };
  }
}

export function defaultMockBusySlots(): BusySlot[] {
  return [
    {
      id: "mock-feishu-weekly-standup",
      source: "mock_feishu",
      externalEventId: "mock-feishu-weekly-standup",
      title: "Weekly standup",
      startAt: new Date("2026-07-06T10:00:00.000Z"),
      endAt: new Date("2026-07-06T10:30:00.000Z")
    },
    {
      id: "mock-feishu-design-review",
      source: "mock_feishu",
      externalEventId: "mock-feishu-design-review",
      title: "Design review",
      startAt: new Date("2026-07-08T14:00:00.000Z"),
      endAt: new Date("2026-07-08T15:00:00.000Z")
    }
  ];
}

function rangesOverlap(
  left: { startAt: Date; endAt: Date },
  right: { startAt: Date; endAt: Date }
): boolean {
  return left.startAt < right.endAt && left.endAt > right.startAt;
}

function copyBusySlot(slot: BusySlot): BusySlot {
  return {
    ...slot,
    startAt: new Date(slot.startAt),
    endAt: new Date(slot.endAt)
  };
}
