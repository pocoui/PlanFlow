import { afterEach, describe, expect, it, vi } from "vitest";

import { getFeishuPrimaryCalendarId } from "../feishuCalendarId";

const FEISHU_PRIMARY_CALENDAR_URL =
  "https://open.feishu.cn/open-apis/calendar/v4/calendars/primary";

function mockFetchResponse(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    json: () => Promise.resolve(body),
  });
}

describe("getFeishuPrimaryCalendarId", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("应返回应用主日历的 calendar_id", async () => {
    const fakeFetch = mockFetchResponse({
      code: 0,
      data: {
        calendar_id: "feishu.cn_xxx@group.calendar.feishu.cn",
        type: "primary",
      },
    });
    vi.stubGlobal("fetch", fakeFetch);

    const calendarId = await getFeishuPrimaryCalendarId("t-test-token");

    expect(calendarId).toBe("feishu.cn_xxx@group.calendar.feishu.cn");
    expect(fakeFetch).toHaveBeenCalledTimes(1);
    expect(fakeFetch).toHaveBeenCalledWith(FEISHU_PRIMARY_CALENDAR_URL, {
      method: "GET",
      headers: {
        Authorization: "Bearer t-test-token",
        "Content-Type": "application/json",
      },
    });
  });

  it("飞书 API 返回错误时应抛出异常", async () => {
    const fakeFetch = mockFetchResponse({
      code: 191002,
      msg: "no calendar access_role",
    });
    vi.stubGlobal("fetch", fakeFetch);

    await expect(
      getFeishuPrimaryCalendarId("t-test-token")
    ).rejects.toThrow(
      "获取飞书主日历失败: [191002] no calendar access_role"
    );
  });
});
