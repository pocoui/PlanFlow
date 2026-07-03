import { describe, expect, it } from "vitest";

import { MockFeishuCalendarProvider } from "../mockFeishuCalendarProvider";

describe("MockFeishuCalendarProvider", () => {
  it("returns busy slots that overlap the requested date range", async () => {
    const provider = new MockFeishuCalendarProvider([
      {
        id: "before",
        source: "mock_feishu",
        title: "Before range",
        startAt: new Date("2026-07-05T09:00:00.000Z"),
        endAt: new Date("2026-07-05T10:00:00.000Z")
      },
      {
        id: "inside",
        source: "mock_feishu",
        title: "Inside range",
        startAt: new Date("2026-07-06T10:00:00.000Z"),
        endAt: new Date("2026-07-06T11:00:00.000Z")
      },
      {
        id: "overlap-end",
        source: "mock_feishu",
        title: "Overlaps end",
        startAt: new Date("2026-07-07T23:30:00.000Z"),
        endAt: new Date("2026-07-08T00:30:00.000Z")
      }
    ]);

    const result = await provider.getBusySlots({
      startAt: new Date("2026-07-06T00:00:00.000Z"),
      endAt: new Date("2026-07-07T23:59:59.999Z")
    });

    expect(result.map((slot) => slot.id)).toEqual(["inside", "overlap-end"]);
  });
});
