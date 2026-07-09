import type { BusySlot } from "@/packages/shared/src/availability-engine";

import type {
  CalendarProvider,
  CreateCalendarEventInput,
  DeleteCalendarEventInput,
  ExternalCalendarEvent,
  GetBusySlotsInput,
  UpdateCalendarEventInput,
} from "./calendarProvider";

const FEISHU_API_BASE = "https://open.feishu.cn/open-apis";

/**
 * FeishuCalendarProvider 的外部依赖，通过依赖注入传入。
 * - getToken: 获取飞书访问令牌（通常由 FeishuTokenManager 提供）
 * - getCalendarId: 获取主日历 ID（通常先调用飞书 primary calendar API）
 */
export interface FeishuCalendarDeps {
  getToken: () => Promise<string>;
  getCalendarId: () => Promise<string>;
}

/** Date → 飞书秒级时间戳字符串 */
function toFeishuTimestamp(date: Date): string {
  return String(Math.floor(date.getTime() / 1000));
}

/** 飞书秒级时间戳字符串 → Date（毫秒） */
function fromFeishuTimestamp(timestamp: string): Date {
  return new Date(Number(timestamp) * 1000);
}

/** 飞书 API 返回 code !== 0 时抛出的错误 */
class FeishuApiError extends Error {
  constructor(
    public readonly code: number,
    msg: string
  ) {
    super(`飞书 API 错误 (code=${code}): ${msg}`);
    this.name = "FeishuApiError";
  }
}

function assertSuccess(data: { code: number; msg?: string }): void {
  if (data.code !== 0) {
    throw new FeishuApiError(data.code, data.msg ?? "未知错误");
  }
}

export class FeishuCalendarProvider implements CalendarProvider {
  constructor(private readonly deps: FeishuCalendarDeps) {}

  async getBusySlots(input: GetBusySlotsInput): Promise<BusySlot[]> {
    const token = await this.deps.getToken();
    const calendarId = await this.deps.getCalendarId();

    const response = await fetch(`${FEISHU_API_BASE}/calendar/v4/freebusy/list`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        time_min: toFeishuTimestamp(input.startAt),
        time_max: toFeishuTimestamp(input.endAt),
        user_id: { calendar_id: calendarId },
      }),
    });

    const data = await response.json();
    assertSuccess(data);

    const freebusy: Array<{
      start_time: { timestamp: string };
      end_time: { timestamp: string };
      free_busy_status: string;
    }> = data.data?.freebusy ?? [];

    return freebusy
      .filter((item) => item.free_busy_status === "busy")
      .map((item, index) => ({
        id: `feishu_busy_${toFeishuTimestamp(input.startAt)}_${index}`,
        source: "feishu" as const,
        title: "忙闲",
        startAt: fromFeishuTimestamp(item.start_time.timestamp),
        endAt: fromFeishuTimestamp(item.end_time.timestamp),
      }));
  }

  async createCalendarEvent(
    input: CreateCalendarEventInput
  ): Promise<ExternalCalendarEvent> {
    const token = await this.deps.getToken();
    const calendarId = await this.deps.getCalendarId();

    const startTimestamp = toFeishuTimestamp(input.startAt);
    const endTimestamp = toFeishuTimestamp(input.endAt);

    console.log(
      `[feishu] createEvent: calendarId=${calendarId}, title="${input.title}", ` +
      `start=${input.startAt.toISOString()} (${startTimestamp}), end=${input.endAt.toISOString()} (${endTimestamp})`
    );

    const body: Record<string, unknown> = {
      summary: input.title,
      start_time: {
        timestamp: startTimestamp,
        timezone: "Asia/Shanghai",
      },
      end_time: {
        timestamp: endTimestamp,
        timezone: "Asia/Shanghai",
      },
      visibility: "default",
      attendee_ability: "can_see_others",
      free_busy_status: "busy",
    };

    if (input.description) {
      body.description = input.description;
    }

    const response = await fetch(
      `${FEISHU_API_BASE}/calendar/v4/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    console.log(`[feishu] createEvent response: code=${data.code}, msg=${data.msg ?? "ok"}`);

    assertSuccess(data);

    const event = data.data.event;
    return {
      externalEventId: event.event_id,
      title: event.summary,
      description: event.description ?? undefined,
      startAt: fromFeishuTimestamp(event.start_time.timestamp),
      endAt: fromFeishuTimestamp(event.end_time.timestamp),
    };
  }

  async updateCalendarEvent(
    input: UpdateCalendarEventInput
  ): Promise<ExternalCalendarEvent> {
    const token = await this.deps.getToken();
    const calendarId = await this.deps.getCalendarId();

    const body: Record<string, unknown> = {
      summary: input.title,
      start_time: {
        timestamp: toFeishuTimestamp(input.startAt),
        timezone: "Asia/Shanghai",
      },
      end_time: {
        timestamp: toFeishuTimestamp(input.endAt),
        timezone: "Asia/Shanghai",
      },
      visibility: "default",
      attendee_ability: "can_see_others",
      free_busy_status: "busy",
    };

    if (input.description) {
      body.description = input.description;
    }

    const response = await fetch(
      `${FEISHU_API_BASE}/calendar/v4/calendars/${calendarId}/events/${input.externalEventId}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();
    assertSuccess(data);

    const event = data.data.event;
    return {
      externalEventId: event.event_id,
      title: event.summary,
      description: event.description ?? undefined,
      startAt: fromFeishuTimestamp(event.start_time.timestamp),
      endAt: fromFeishuTimestamp(event.end_time.timestamp),
    };
  }

  async deleteCalendarEvent(
    input: DeleteCalendarEventInput
  ): Promise<void> {
    const token = await this.deps.getToken();
    const calendarId = await this.deps.getCalendarId();

    const response = await fetch(
      `${FEISHU_API_BASE}/calendar/v4/calendars/${calendarId}/events/${input.externalEventId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await response.json();
    assertSuccess(data);
  }
}
