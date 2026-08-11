import { loadEnvConfig } from "@next/env";
import { test, expect, type Page } from "@playwright/test";

// Playwright 运行时不自动加载 Next 的 .env，手动载入以读取管理员凭据
loadEnvConfig(process.cwd());

// dev server 按需编译路由可能较慢，放宽默认 30s 超时
test.setTimeout(120_000);

/** 读取浏览器上下文中的 CSRF token（Double-Submit Cookie 模式） */
async function csrfTokenFor(page: Page): Promise<string> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === "csrf_token")?.value ?? "";
}

test("dashboard opens review modal from reviewSessionId URL parameter", async ({ page }) => {
  // 0. 经登录页 UI 登录（管理员凭据来自 .env），业务 API 已全站保护
  await page.goto("/login");
  await page.locator('input[type="email"]').fill(process.env.ADMIN_EMAIL!);
  await page.locator('input[type="password"]').fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "登录" }).click();
  await page.waitForURL("/");

  // 1. 通过 API 创建计划（page.request 与浏览器共享会话 cookie，带登录态）
  const createResponse = await page.request.post("/api/plans", {
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

  // 业务 API 为 Double-Submit CSRF：首次请求种下 csrf_token cookie，后续 mutating
  // 请求必须回传 x-csrf-token 头（前端 csrfFetch 自动处理，此处手动补上）
  const csrfToken = await csrfTokenFor(page);

  // 2. 生成任务和排程
  const generateResponse = await page.request.post(`/api/plans/${plan.id}/generate`, {
    headers: { "x-csrf-token": csrfToken }
  });
  expect(generateResponse.ok()).toBe(true);
  const generation = await generateResponse.json();
  expect(generation.sessions.length).toBeGreaterThan(0);

  const sessionId = generation.sessions[0].id;

  // 3. 标记第一个日程完成
  const completeResponse = await page.request.patch(`/api/sessions/${sessionId}/status`, {
    headers: { "x-csrf-token": csrfToken },
    data: { status: "completed" }
  });
  expect(
    completeResponse.ok(),
    `PATCH session status -> ${completeResponse.status()}: ${await completeResponse.text()}`
  ).toBe(true);

  // 4. 访问带 reviewSessionId 的 dashboard URL。
  //    同时传 planId（与 home-page 导航一致）：无 planId 时 dashboard 只自动选中
  //    第一个 generated 计划，历史运行累积的计划会让本次 session 落不到正确计划上。
  await page.goto(`/dashboard?planId=${plan.id}&reviewSessionId=${sessionId}`);

  // 5. 断言复盘弹窗可见。
  //    ReviewDialog 未声明 role="dialog"，按弹窗唯一标题「日程复盘」断言。
  await expect(page.getByRole("heading", { name: "日程复盘" })).toBeVisible();

  // 6. 清理：删除本次计划，避免跨运行累积影响后续 auto-select
  const cleanupResponse = await page.request.delete(`/api/plans/${plan.id}`, {
    headers: { "x-csrf-token": csrfToken }
  });
  expect(cleanupResponse.ok()).toBe(true);
});
