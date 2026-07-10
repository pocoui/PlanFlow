import { test, expect } from "@playwright/test";

test("dashboard opens review modal from reviewSessionId URL parameter", async ({ page, request }) => {
  // 1. 通过 API 创建计划
  const createResponse = await request.post("/api/plans", {
    data: {
      title: "E2E Review Modal Test",
      goal: "测试 dashboard reviewSessionId 参数自动打开复盘弹窗。",
      totalMinutes: 60,
      startDate: "2026-07-06",
      deadline: "2026-07-12",
      rescheduleBufferMinutes: 15,
      availability: [{ weekday: 1, startTime: "09:00", endTime: "12:00" }]
    }
  });
  expect(createResponse.ok()).toBe(true);
  const plan = await createResponse.json();

  // 2. 生成任务和排程
  const generateResponse = await request.post(`/api/plans/${plan.id}/generate`);
  expect(generateResponse.ok()).toBe(true);
  const generation = await generateResponse.json();
  expect(generation.sessions.length).toBeGreaterThan(0);

  const sessionId = generation.sessions[0].id;

  // 3. 标记第一个日程完成
  const completeResponse = await request.patch(`/api/sessions/${sessionId}/status`, {
    data: { status: "completed" }
  });
  expect(completeResponse.ok()).toBe(true);

  // 4. 访问带 reviewSessionId 的 dashboard URL
  await page.goto(`/dashboard?reviewSessionId=${sessionId}`);

  // 5. 断言复盘弹窗可见
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("复盘").first()).toBeVisible();
});
