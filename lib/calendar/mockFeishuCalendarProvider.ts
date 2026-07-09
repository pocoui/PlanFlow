import type { BusySlot } from "@/packages/shared/src/availability-engine";

import type {
  CalendarProvider,
  CreateCalendarEventInput,
  DeleteCalendarEventInput,
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async deleteCalendarEvent(_input: DeleteCalendarEventInput): Promise<void> {
    // mock: no-op
  }
}

export function defaultMockBusySlots(): BusySlot[] {
  // TODO: 任务冲突逻辑暂不实现，后续对接真实日历 API 时再开启
  return [];
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
