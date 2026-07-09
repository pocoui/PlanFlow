import { describe, it, expect, vi, beforeEach } from "vitest";
import { FeishuCalendarProvider } from "../feishuCalendarProvider";
import type { FeishuCalendarDeps } from "../feishuCalendarProvider";

const BASE_URL = "https://open.feishu.cn/open-apis";

function createMockDeps(): FeishuCalendarDeps {
  return {
    getToken: vi.fn().mockResolvedValue("mock-token"),
    getCalendarId: vi.fn().mockResolvedValue("cal_123"),
  };
}

function mockFetchResponse(body: unknown, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  });
}

describe("FeishuCalendarProvider", () => {
  let deps: FeishuCalendarDeps;
  let provider: FeishuCalendarProvider;

  beforeEach(() => {
    vi.restoreAllMocks();
    deps = createMockDeps();
    provider = new FeishuCalendarProvider(deps);
  });

  describe("createCalendarEvent", () => {
    it("应调用飞书创建日程 API 并返回 ExternalCalendarEvent", async () => {
      const eventId = "evt_created_001";
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockFetchResponse({
          code: 0,
          data: {
            event: {
              event_id: eventId,
              summary: "测试日程",
              description: "描述内容",
              start_time: { timestamp: "1689069600", timezone: "Asia/Shanghai" },
              end_time: { timestamp: "1689073200", timezone: "Asia/Shanghai" },
            },
          },
        }) as unknown as Response
      );

      const result = await provider.createCalendarEvent({
        title: "测试日程",
        description: "描述内容",
        startAt: new Date(1689069600 * 1000),
        endAt: new Date(1689073200 * 1000),
      });

      expect(result).toEqual({
        externalEventId: eventId,
        title: "测试日程",
        description: "描述内容",
        startAt: new Date(1689069600 * 1000),
        endAt: new Date(1689073200 * 1000),
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/calendar/v4/calendars/cal_123/events`);
      expect(init!.method).toBe("POST");
      expect(init!.headers).toMatchObject({
        Authorization: "Bearer mock-token",
        "Content-Type": "application/json",
      });

      const body = JSON.parse(init!.body as string);
      expect(body).toEqual({
        summary: "测试日程",
        description: "描述内容",
        start_time: { timestamp: "1689069600", timezone: "Asia/Shanghai" },
        end_time: { timestamp: "1689073200", timezone: "Asia/Shanghai" },
        visibility: "default",
        attendee_ability: "can_see_others",
        free_busy_status: "busy",
      });
    });

    it("飞书 API 返回错误时应抛出异常", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockFetchResponse({
          code: 190001,
          msg: "calendar not found",
        }) as unknown as Response
      );

      await expect(
        provider.createCalendarEvent({
          title: "测试",
          startAt: new Date(1689069600 * 1000),
          endAt: new Date(1689073200 * 1000),
        })
      ).rejects.toThrow("飞书 API 错误");
    });
  });

  describe("updateCalendarEvent", () => {
    it("应调用飞书更新日程 API", async () => {
      const eventId = "evt_update_001";
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockFetchResponse({
          code: 0,
          data: {
            event: {
              event_id: eventId,
              summary: "更新标题",
              description: "更新描述",
              start_time: { timestamp: "1689069600", timezone: "Asia/Shanghai" },
              end_time: { timestamp: "1689073200", timezone: "Asia/Shanghai" },
            },
          },
        }) as unknown as Response
      );

      const result = await provider.updateCalendarEvent({
        externalEventId: eventId,
        title: "更新标题",
        description: "更新描述",
        startAt: new Date(1689069600 * 1000),
        endAt: new Date(1689073200 * 1000),
      });

      expect(result).toEqual({
        externalEventId: eventId,
        title: "更新标题",
        description: "更新描述",
        startAt: new Date(1689069600 * 1000),
        endAt: new Date(1689073200 * 1000),
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(
        `${BASE_URL}/calendar/v4/calendars/cal_123/events/${eventId}`
      );
      expect(init!.method).toBe("PATCH");
    });
  });

  describe("deleteCalendarEvent", () => {
    it("应调用飞书删除日程 API", async () => {
      const eventId = "evt_delete_001";
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockFetchResponse({ code: 0 }) as unknown as Response
      );

      await provider.deleteCalendarEvent({ externalEventId: eventId });

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(
        `${BASE_URL}/calendar/v4/calendars/cal_123/events/${eventId}`
      );
      expect(init!.method).toBe("DELETE");
    });
  });

  describe("getBusySlots", () => {
    it("应调用飞书忙闲查询 API 并转换为 BusySlot[]", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockFetchResponse({
          code: 0,
          data: {
            freebusy: [
              {
                start_time: { timestamp: "1689069600" },
                end_time: { timestamp: "1689073200" },
                free_busy_status: "busy",
              },
            ],
          },
        }) as unknown as Response
      );

      const result = await provider.getBusySlots({
        startAt: new Date(1689000000 * 1000),
        endAt: new Date(1689100000 * 1000),
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: expect.any(String),
        source: "feishu",
        title: "忙闲",
        startAt: new Date(1689069600 * 1000),
        endAt: new Date(1689073200 * 1000),
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toBe(`${BASE_URL}/calendar/v4/freebusy/list`);
      expect(init!.method).toBe("POST");

      const body = JSON.parse(init!.body as string);
      expect(body).toEqual({
        time_min: "1689000000",
        time_max: "1689100000",
        user_id: { calendar_id: "cal_123" },
      });
    });

    it("只返回 free_busy_status 为 busy 的项", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        mockFetchResponse({
          code: 0,
          data: {
            freebusy: [
              {
                start_time: { timestamp: "1689069600" },
                end_time: { timestamp: "1689073200" },
                free_busy_status: "busy",
              },
              {
                start_time: { timestamp: "1689073200" },
                end_time: { timestamp: "1689076800" },
                free_busy_status: "free",
              },
              {
                start_time: { timestamp: "1689076800" },
                end_time: { timestamp: "1689080400" },
                free_busy_status: "tentative",
              },
            ],
          },
        }) as unknown as Response
      );

      const result = await provider.getBusySlots({
        startAt: new Date(1689000000 * 1000),
        endAt: new Date(1689100000 * 1000),
      });

      // 只有 busy 状态的项被返回
      expect(result).toHaveLength(1);
      expect(result[0].startAt).toEqual(new Date(1689069600 * 1000));
      expect(result[0].endAt).toEqual(new Date(1689073200 * 1000));
    });
  });
});
