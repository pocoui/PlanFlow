# 首页改造实现计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 PlanFlow AI 首页从功能入口页改造为「今日学习仪表盘」，同时扩展后端 `hasReview` 字段和 dashboard 的 `reviewSessionId` URL 参数支持。

**Architecture:** 后端在 `ScheduledSessionRecord` 上增加 `hasReview` 计算字段，同步改造 in-memory 和 Prisma repository；前端新增 `lib/client/home.ts` 负责首页数据聚合，新增 `components/home/*` 子组件，改造 `app/page.tsx` 和 `app/dashboard/page.tsx`。

**Tech Stack:** Next.js App Router + React + TypeScript, Tailwind CSS, lucide-react, Vitest, Playwright

---

## 文件结构映射

| 文件 | 职责 | 操作 |
|---|---|---|
| `lib/services/planService.ts` | 后端 Session 类型与 repository 实现 | 修改：增加 `hasReview`，改造 in-memory / Prisma mapping |
| `lib/client/planDashboard.ts` | Dashboard 客户端类型与 API 调用 | 修改：`DashboardSession` 增加 `hasReview` |
| `app/dashboard/page.tsx` | Dashboard 页面入口 | 修改：读取 URL `reviewSessionId` 并传给 PlanDashboard |
| `components/plan-dashboard.tsx` | Dashboard 主组件 | 修改：`useEffect` 根据 URL `reviewSessionId` 自动打开复盘弹窗 |
| `lib/client/home.ts` | 首页数据聚合、类型、工具函数 | 新增 |
| `lib/client/__tests__/home.test.ts` | 首页聚合函数单元测试 | 新增 |
| `app/page.tsx` | 首页页面入口 | 改造：使用新的 HomePage 组件 |
| `components/home/home-page.tsx` | 首页主容器 | 新增 |
| `components/home/empty-home.tsx` | 空状态组件 | 新增 |
| `components/home/today-sessions.tsx` | 今日学习列表 | 新增 |
| `components/home/plan-progress-card.tsx` | 计划进度卡片 | 新增 |
| `components/home/pending-alerts.tsx` | 待处理提醒 | 新增 |
| `components/home/quick-actions.tsx` | 快捷操作 | 新增 |
| `components/home/home-skeleton.tsx` | 首页加载骨架屏 | 新增 |
| `components/home/error-card.tsx` | 错误提示卡片 | 新增 |
| `components/home/greeting.tsx` | 顶部问候区 | 新增 |
| `lib/utils.ts` | 已有工具函数 | 必要时补充时间/进度工具 |

> 注：
> - 当前项目未配置 jsdom/happy-dom，Vitest 环境为 `node`。本次计划的组件测试主要依赖 TypeScript 类型检查、lint 和 Playwright E2E；纯函数单元测试使用 Vitest。
> - 当前项目未初始化 shadcn/ui，现有组件均使用 Tailwind CSS + `lucide-react` 手写。本次 UI 子组件同样采用 Tailwind + `lucide-react` 原生实现，不引入 shadcn/ui。

---

## Task 1: 后端 Session 类型扩展 `hasReview`

**Files:**
- Modify: `lib/services/planService.ts:83-88`
- Modify: `lib/client/planDashboard.ts:10-17`
- Test: `lib/services/__tests__/planService.test.ts`

**Context:**
当前 `ScheduledSessionRecord` 和 `DashboardSession` 均不包含 `hasReview`。首页「待复盘」提醒依赖该字段判断 session 是否已复盘。

- [ ] **Step 1: 写失败测试**
  在 `lib/services/__tests__/planService.test.ts` 中新增测试：
  ```ts
  it("should return hasReview=false for completed session without review", async () => {
    // 创建 plan，生成 session，标记完成，获取 plan details
    // 断言 session.hasReview === false
  });

  it("should return hasReview=true for completed session with review", async () => {
    // 创建 plan，生成 session，标记完成，提交复盘，获取 plan details
    // 断言 session.hasReview === true
  });
  ```

- [ ] **Step 2: 运行测试确认失败**
  Run: `npx vitest run lib/services/__tests__/planService.test.ts`
  Expected: FAIL，提示 `hasReview` 不存在或断言失败。

- [ ] **Step 3: 修改类型定义**
  在 `lib/services/planService.ts` 中：
  ```ts
  export interface ScheduledSessionRecord extends Omit<ScheduledSession, "status"> {
    id: string;
    planId: string;
    status: SessionStatus;
    externalEventId?: string;
    hasReview: boolean;
  }
  ```

  在 `lib/client/planDashboard.ts` 中：
  ```ts
  export interface DashboardSession {
    id: string;
    taskId: string;
    startAt: string;
    endAt: string;
    durationMinutes?: number;
    status: string;
    hasReview: boolean;
  }
  ```

- [ ] **Step 4: 改造 in-memory repository 初始化 `hasReview`**
  由于 `ScheduledSessionRecord.hasReview` 变为必填字段，所有创建 session 的位置都必须初始化 `hasReview: false`：
  - `savePlanGeneration` / `savePlanSchedule` 中生成 session 时。
  - in-memory repository 中任何直接构造 `ScheduledSessionRecord` 的位置（如 `copySession`、`mapPrismaSession` 的对侧）。
  - `saveSessionReview` 中提交复盘后设置为 `hasReview: true`。

  例如，在生成 session 时：
  ```ts
  const session: ScheduledSessionRecord = {
    // ... 其他字段
    hasReview: false
  };
  ```

  在 `saveSessionReview` 中：
  ```ts
  session.hasReview = true;
  ```

- [ ] **Step 5: 改造 Prisma repository 的 `planInclude`、`PrismaPlanShape` 与 `mapPrismaSession`**
  1. 找到 `PrismaPlanShape` 类型定义，在 sessions 字段中增加 `review?: { id: string } | null`（或 Prisma 生成的 review 类型），标记为可选以兼容未 include review 的调用点。
  2. 在 `planInclude`（用于 `getPlan`）的 sessions 中增加 `{ include: { review: { select: { id: true } } } }`（只取 id 即可判断是否存在）。
  3. 在 `mapPrismaSession` 中：
     ```ts
     hasReview: session.review !== undefined ? session.review !== null : false,
     ```
  4. 检查所有调用 `mapPrismaSession` 的位置：
     - `getPlan`：已 include review，正常返回 hasReview。
     - `updateSessionStatus`、`updateSessionExternalEventId`、`getSessionContext`：未 include review，返回 `hasReview: false`。
     - 如 typecheck 报错，说明某些调用点的 session 类型未包含 `review` 字段，需要调整 `mapPrismaSession` 的输入类型使 `review` 可选。

- [ ] **Step 6: 运行测试确认通过**
  Run: `npx vitest run lib/services/__tests__/planService.test.ts`
  Expected: PASS。

- [ ] **Step 7: 检查乐观更新中的 hasReview 保留**
  在 `components/plan-dashboard.tsx` 中找到 `completeSession` 或类似的乐观更新逻辑。当前仅更新 `session.status` 的本地状态时，需要确保 `hasReview` 字段不丢失。例如：
  ```ts
  setPlan((prev) => ({
    ...prev,
    sessions: prev.sessions.map((s) =>
      s.id === sessionId ? { ...s, status: "completed" } : s
    )
  }));
  ```
  由于 `hasReview` 已在 `DashboardSession` 中声明，展开操作会保留它，无需额外修改。但需在 typecheck 后确认无错误。

- [ ] **Step 8: 运行 typecheck**
  Run: `npm run typecheck`
  Expected: 无类型错误。

- [ ] **Step 9: Commit**
  ```bash
  git add lib/services/planService.ts lib/client/planDashboard.ts lib/services/__tests__/planService.test.ts
  git commit -m "feat: 在 session 记录中增加 hasReview 字段"
  ```

---

## Task 2: Dashboard 支持 `reviewSessionId` URL 参数

**Files:**
- Modify: `app/dashboard/page.tsx`
- Modify: `components/plan-dashboard.tsx:72-99`
- Test: `test/e2e/dashboard-review-modal.spec.ts`（新增 Playwright 用例，若项目无此目录则调整路径）

**Context:**
首页点击「去复盘」或「标记完成」后，需要跳转到 dashboard 并自动打开复盘弹窗。

- [ ] **Step 1: 写失败测试**
  在 E2E 测试目录新增 `dashboard-review-modal.spec.ts`：
  ```ts
  import { test, expect } from "@playwright/test";

  test("dashboard opens review modal from reviewSessionId URL parameter", async ({ page }) => {
    // 假设已通过 API 或 UI 创建 plan 并标记一个 session 为 completed
    await page.goto("/dashboard?planId=test-plan-id&reviewSessionId=test-session-id");
    // 断言复盘弹窗标题或表单元素可见
    await expect(page.getByText("复盘")).toBeVisible();
  });
  ```
  Run: `npx playwright test test/e2e/dashboard-review-modal.spec.ts`
  Expected: FAIL，因为 dashboard 尚未支持该 URL 参数。

- [ ] **Step 2: 修改 PlanDashboard 组件接收初始 reviewSessionId**
  在 `components/plan-dashboard.tsx` 中：
  ```ts
  export interface PlanDashboardProps {
    planId?: string;
    initialReviewSessionId?: string | null;
  }

  export function PlanDashboard({ planId, initialReviewSessionId }: PlanDashboardProps) {
    // ...
    const [reviewSessionId, setReviewSessionId] = useState<string | null>(initialReviewSessionId ?? null);
    // ...
  }
  ```

- [ ] **Step 3: 修改 dashboard 页面读取 URL 参数并透传**
  在 `app/dashboard/page.tsx` 的现有 `DashboardContent` 组件内部读取 `useSearchParams`，把 `reviewSessionId` 透传给 `PlanDashboard`，保留无 `planId` 时的现有计划列表加载/选择逻辑。修改后的 `DashboardContent` 大致结构：
  ```tsx
  function DashboardContent() {
    const searchParams = useSearchParams();
    const planId = searchParams.get("planId") ?? undefined;
    const reviewSessionId = searchParams.get("reviewSessionId");

    // 保留现有的计划列表加载、默认选择、删除逻辑
    // ...

    return (
      <PlanDashboard
        planId={selectedPlanId ?? planId}
        initialReviewSessionId={reviewSessionId}
      />
    );
  }
  ```
  注意：`PlanDashboard` 内部继续支持 `planId` 为空时自动加载计划列表；`selectedPlanId` 为现有逻辑中选中的计划 ID。

- [ ] **Step 4: 增加 useEffect 在数据加载后校验 reviewSessionId**
  在 `loadPlan` 成功后，如果 `initialReviewSessionId` 存在但对应 session 不存在或 `hasReview === true`，则忽略该参数：
  ```ts
  useEffect(() => {
    if (!initialReviewSessionId || !plan) return;
    const session = plan.sessions.find((s) => s.id === initialReviewSessionId);
    if (!session || session.hasReview) {
      setReviewSessionId(null);
    }
  }, [plan, initialReviewSessionId]);
  ```

- [ ] **Step 5: 运行 Playwright 测试确认通过**
  Run: `npx playwright test test/e2e/dashboard-review-modal.spec.ts`
  Expected: PASS（或根据实际弹窗文案调整断言后通过）。

- [ ] **Step 6: 运行 typecheck**
  Run: `npm run typecheck`
  Expected: 无类型错误。

- [ ] **Step 7: Commit**
  ```bash
  git add app/dashboard/page.tsx components/plan-dashboard.tsx test/e2e/dashboard-review-modal.spec.ts
  git commit -m "feat: dashboard 支持 reviewSessionId URL 参数自动打开复盘弹窗"
  ```

---

## Task 3: 首页数据聚合逻辑 `lib/client/home.ts`

**Files:**
- Create: `lib/client/home.ts`
- Create: `lib/client/__tests__/home.test.ts`
- Modify: `lib/client/planDashboard.ts`（如需复用类型/工具）

**Context:**
首页需要并发获取多个 plan 的详情，并聚合出今日学习、计划进度、待处理提醒。

- [ ] **Step 1: 写失败测试**
  创建 `lib/client/__tests__/home.test.ts`，覆盖以下场景：
  ```ts
  import { describe, it, expect } from "vitest";
  import { aggregateHomeData } from "./home";

  describe("aggregateHomeData", () => {
    it("returns empty state when no plans", () => {
      const result = aggregateHomeData([]);
      expect(result.hasPlans).toBe(false);
      expect(result.todaySessions).toEqual([]);
    });

    it("filters today sessions from generated plans", () => {
      // 构造两个 plan，一个 generated，一个 draft
      // 断言 only generated plan sessions are included
    });

    it("calculates progress by completed minutes", () => {
      // 构造 plan，totalMinutes=120，一个 completed session 30min
      // 断言 progressPercent=25
    });

    it("returns review alerts for completed sessions without review", () => {
      // 构造 completed session with hasReview=false
      // 断言 alerts 包含 review 类型
    });

    it("handles totalMinutes=0 without NaN", () => {
      // 断言 progressPercent=0
    });
  });
  ```

- [ ] **Step 2: 运行测试确认失败**
  Run: `npx vitest run lib/client/__tests__/home.test.ts`
  Expected: FAIL，提示 `aggregateHomeData` 不存在。

- [ ] **Step 3: 实现聚合函数**
  创建 `lib/client/home.ts`：
  ```ts
  import type { DashboardPlan, DashboardSession } from "./planDashboard";

  export interface HomeData {
    hasPlans: boolean;
    partialFailure?: boolean;
    plans: HomePlanSummary[];
    todaySessions: HomeTodaySession[];
    pendingAlerts: HomeAlert[];
  }

  export interface HomePlanSummary {
    id: string;
    title: string;
    status: "draft" | "generated" | "archived";
    totalMinutes: number;
    completedMinutes: number;
    progressPercent: number;
    nextSession: {
      id: string;
      taskTitle: string;
      startAt: string;
      endAt: string;
    } | null;
  }

  export interface HomeTodaySession {
    id: string;
    planId: string;
    planTitle: string;
    taskId: string;
    taskTitle: string;
    startAt: string;
    endAt: string;
    status: "scheduled" | "conflicted";
  }

  export interface HomeAlert {
    type: "review" | "feishu_auth" | "conflict";
    message: string;
    actionLabel: string;
    planId: string;
    sessionId?: string;
    action: {
      kind: "href" | "authorize";
      payload?: string;
    };
  }

  // MVP 第一步不生成 conflict 提醒，但类型保留以对齐设计规格

  export function aggregateHomeData(plans: DashboardPlan[]): HomeData {
    // 实现聚合逻辑
  }

  export function getTodaySessionStatus(session: DashboardSession, now: Date): string {
    // 返回 "未开始" / "进行中" / "冲突"
  }
  ```

  关键实现细节：
  - 仅处理 `status === "generated"` 的 plan，返回的 `HomeData.plans` 实际上只包含该状态。
  - 今日 session 按浏览器本地日期筛选（使用 `new Date(startAt).getFullYear()/getMonth()/getDate()`）。
  - `completedMinutes` 累加 `status === "completed"` session 的 `durationMinutes` 或计算 `endAt-startAt`。
  - `progressPercent` 使用 `Math.min(100, ...)`。
  - 待复盘 alert 按 session 拆分。

- [ ] **Step 4: 运行测试确认通过**
  Run: `npx vitest run lib/client/__tests__/home.test.ts`
  Expected: PASS。

- [ ] **Step 5: Commit**
  ```bash
  git add lib/client/home.ts lib/client/__tests__/home.test.ts
  git commit -m "feat: 新增首页数据聚合逻辑与单元测试"
  ```

---

## Task 4: 首页 API 加载层 `components/home/home-page.tsx`

**Files:**
- Create: `components/home/home-page.tsx`
- Modify: `lib/client/home.ts`（如需补充 fetcher）

**Context:**
`home-page.tsx` 负责调用 `GET /api/plans` 和并发 `GET /api/plans/:id`，管理 loading/error 状态，并把聚合后的数据分发给子组件。

- [ ] **Step 1: 实现 fetch 函数**
  在 `lib/client/home.ts` 中补充：
  ```ts
  import { fetchPlanDashboard } from "./planDashboard";

  export interface FetchHomeDataOptions {
    retryPlanIds?: string[];
  }

  export async function fetchHomeData(options: FetchHomeDataOptions = {}): Promise<HomeData & { failedPlanIds: string[] }> {
    const listResponse = await fetch("/api/plans");
    if (!listResponse.ok) {
      throw new Error("加载计划列表失败");
    }
    const plans = (await listResponse.json()) as Array<{ id: string; status: string }>;

    if (plans.length === 0) {
      return { hasPlans: false, failedPlanIds: [], plans: [], todaySessions: [], pendingAlerts: [] };
    }

    const generatedPlans = plans.filter((p) => p.status === "generated");
    const plansToFetch = options.retryPlanIds
      ? generatedPlans.filter((p) => options.retryPlanIds!.includes(p.id))
      : generatedPlans;

    const detailResults = await Promise.allSettled(
      plansToFetch.map((p) => fetchPlanDashboard(p.id))
    );

    const fulfilledPlans = detailResults
      .map((r) => (r.status === "fulfilled" ? r.value : null))
      .filter((p): p is DashboardPlan => p !== null);

    const failedPlanIds = plansToFetch
      .filter((_, index) => detailResults[index].status === "rejected")
      .map((p) => p.id);

    const hasPartialFailure = failedPlanIds.length > 0;

    const data = aggregateHomeData(fulfilledPlans);
    return { ...data, hasPlans: plans.length > 0, partialFailure: hasPartialFailure, failedPlanIds };
  }
  ```

- [ ] **Step 2: 实现 HomePage 组件（占位版）**
  创建 `components/home/home-page.tsx`，先用占位组件保证 typecheck 通过，Task 5 再替换为真实子组件：
  ```tsx
  "use client";

  import { useEffect, useState } from "react";
  import { fetchHomeData, HomeData } from "@/lib/client/home";

  // TODO: Task 5 替换为真实组件
  const EmptyHome = () => <div>空状态占位</div>;
  const TodaySessions = ({ sessions }: { sessions: HomeData["todaySessions"] }) => (
    <div>今日学习占位：{sessions.length} 个日程</div>
  );
  const PlanProgressCard = ({ plan }: { plan: HomeData["plans"][0] }) => (
    <div>计划进度占位：{plan.title}</div>
  );
  const PendingAlerts = ({ alerts }: { alerts: HomeData["pendingAlerts"] }) => (
    <div>提醒占位：{alerts.length} 条</div>
  );
  const QuickActions = ({ plans }: { plans: HomeData["plans"] }) => (
    <div>快捷操作占位</div>
  );
  const HomeSkeleton = () => <div>加载中...</div>;
  const ErrorCard = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
    <div>{message} <button onClick={onRetry}>重试</button></div>
  );
  const Greeting = ({ todaySessions }: { todaySessions: HomeData["todaySessions"] }) => (
    <div>早上好，准备好学习了吗？今日 {todaySessions.length} 个日程</div>
  );

  export function HomePage() {
    const [state, setState] = useState<{
      loading: boolean;
      data?: HomeData & { failedPlanIds: string[] };
      error?: string;
    }>({ loading: true });

    const load = async (retryPlanIds?: string[]) => {
      setState((prev) => ({ ...prev, loading: true, error: undefined }));
      try {
        const freshData = await fetchHomeData({ retryPlanIds });
        setState((prev) => {
          if (!prev.data || !retryPlanIds) {
            return { loading: false, data: freshData };
          }
          // 合并重试结果：保留旧数据，用新数据覆盖对应计划
          const mergedPlans = prev.data.plans
            .filter((p) => !retryPlanIds.includes(p.id) || freshData.plans.some((np) => np.id === p.id))
            .map((p) => freshData.plans.find((np) => np.id === p.id) ?? p);
          const mergedTodaySessions = [...prev.data.todaySessions, ...freshData.todaySessions].filter(
            (s, index, self) => self.findIndex((x) => x.id === s.id) === index
          );
          const mergedAlerts = [...prev.data.pendingAlerts, ...freshData.pendingAlerts].filter(
            (a, index, self) => self.findIndex((x) => x.sessionId === a.sessionId) === index
          );
          return {
            loading: false,
            data: {
              ...freshData,
              plans: mergedPlans,
              todaySessions: mergedTodaySessions,
              pendingAlerts: mergedAlerts
            }
          };
        });
      } catch (error) {
        setState({
          loading: false,
          error: error instanceof Error ? error.message : "加载失败"
        });
      }
    };

    useEffect(() => {
      void load();
    }, []);

    const handleRetryFailed = () => {
      const failedPlanIds = state.data?.failedPlanIds;
      if (failedPlanIds && failedPlanIds.length > 0) {
        void load(failedPlanIds);
      } else {
        void load();
      }
    };

    if (state.loading && !state.data) return <HomeSkeleton />;
    if (state.error) return <ErrorCard message={state.error} onRetry={() => void load()} />;

    const data = state.data!;

    if (!data.hasPlans) {
      return <EmptyHome />;
    }

    return (
      <div className="mx-auto max-w-4xl space-y-6">
        {data.partialFailure && (
          <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span>部分计划加载失败</span>
            <button onClick={handleRetryFailed} className="font-medium underline">
              重试
            </button>
          </div>
        )}
        <Greeting todaySessions={data.todaySessions} />
        <TodaySessions sessions={data.todaySessions} onRefresh={() => void load()} />
        <div className="grid gap-4 md:grid-cols-2">
          {data.plans.map((plan) => (
            <PlanProgressCard key={plan.id} plan={plan} />
          ))}
        </div>
        <PendingAlerts alerts={data.pendingAlerts} />
        <QuickActions plans={data.plans} />
      </div>
    );
  }
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add lib/client/home.ts components/home/home-page.tsx
  git commit -m "feat: 实现首页数据加载与状态管理"
  ```

---

## Task 5: 首页 UI 子组件

**Files:**
- Create: `components/home/empty-home.tsx`
- Create: `components/home/today-sessions.tsx`
- Create: `components/home/plan-progress-card.tsx`
- Create: `components/home/pending-alerts.tsx`
- Create: `components/home/quick-actions.tsx`
- Create: `components/home/home-skeleton.tsx`
- Create: `components/home/error-card.tsx`
- Create: `components/home/greeting.tsx`

**Context:**
将首页拆分为职责单一的子组件，便于维护和测试。

- [ ] **Step 1: EmptyHome 空状态组件**
  创建 `components/home/empty-home.tsx`：
  包含价值主张、3 步流程预览、创建 CTA。

- [ ] **Step 2: Greeting 问候区组件**
  创建 `components/home/greeting.tsx`：
  根据当前时间显示问候语和今日日程数量。

- [ ] **Step 3: TodaySessions 今日学习组件**
  创建 `components/home/today-sessions.tsx`：
  展示今日 session 列表，处理「跳过」「标记完成」操作，展示空状态。

- [ ] **Step 4: PlanProgressCard 计划进度卡片**
  创建 `components/home/plan-progress-card.tsx`：
  展示进度条、已完成时长、下次学习、查看日历/导出按钮。

- [ ] **Step 5: PendingAlerts 待处理提醒**
  创建 `components/home/pending-alerts.tsx`：
  渲染 review 和 feishu_auth 提醒，处理跳转/授权。

- [ ] **Step 6: QuickActions 快捷操作**
  创建 `components/home/quick-actions.tsx`：
  创建计划、学习日历、导出 .ics 按钮。

- [ ] **Step 7: HomeSkeleton 骨架屏**
  创建 `components/home/home-skeleton.tsx`：
  按模块结构展示骨架占位。

- [ ] **Step 8: ErrorCard 错误卡片**
  创建 `components/home/error-card.tsx`：
  展示错误信息和重试按钮。

- [ ] **Step 9: 替换 home-page.tsx 中的占位组件为真实组件**
  修改 `components/home/home-page.tsx`：
  删除占位组件定义，改为从同级文件 import：
  ```tsx
  import { EmptyHome } from "./empty-home";
  import { TodaySessions } from "./today-sessions";
  import { PlanProgressCard } from "./plan-progress-card";
  import { PendingAlerts } from "./pending-alerts";
  import { QuickActions } from "./quick-actions";
  import { HomeSkeleton } from "./home-skeleton";
  import { ErrorCard } from "./error-card";
  import { Greeting } from "./greeting";
  ```

- [ ] **Step 10: 运行 typecheck**
  Run: `npm run typecheck`
  Expected: 无类型错误。

- [ ] **Step 11: Commit**
  ```bash
  git add components/home/
  git commit -m "feat: 实现首页仪表盘子组件"
  ```

---

## Task 6: 改造 `app/page.tsx`

**Files:**
- Modify: `app/page.tsx`

**Context:**
替换现有三个入口卡片的首页为新的仪表盘。

- [ ] **Step 1: 替换 page.tsx 内容**
  ```tsx
  import { HomePage } from "@/components/home/home-page";

  export default function Page() {
    return <HomePage />;
  }
  ```

- [ ] **Step 2: 运行 typecheck**
  Run: `npm run typecheck`
  Expected: 无类型错误。

- [ ] **Step 3: Commit**
  ```bash
  git add app/page.tsx
  git commit -m "feat: 首页入口改造为仪表盘"
  ```

---

## Task 7: 集成验证与质量检查

**Files:**
- 全部修改过的文件

- [ ] **Step 1: 运行全部单元测试**
  Run: `npm run test`
  Expected: 全部通过。

- [ ] **Step 2: 运行 lint**
  Run: `npm run lint`
  Expected: 无错误。

- [ ] **Step 3: 运行 typecheck**
  Run: `npm run typecheck`
  Expected: 无错误。

- [ ] **Step 4: 启动开发服务并手动验证**
  Run: `npm run dev`
  手动验证：
  1. 无计划时展示空状态。
  2. 有计划时展示今日学习、进度、快捷操作。
  3. 标记完成 session 后跳转 dashboard 并自动打开复盘弹窗。
  4. 跳过 session 后首页刷新。
  5. 同步飞书授权异常时展示提醒并可跳转授权。
  6. 直接访问 `/dashboard`（无 planId）仍能正常加载计划列表，不报错。

- [ ] **Step 5: 运行 E2E 测试（如已有用例覆盖首页）**
  Run: `npm run test:e2e`
  Expected: 通过或根据新增页面补充用例。

- [ ] **Step 6: Commit**
  ```bash
  git add .
  git commit -m "chore: 首页改造集成验证与质量检查"
  ```

---

## 依赖与风险

### 外部依赖

- 已确认项目有 `@testing-library/react`，但 Vitest 环境为 `node`。如需要测试 React 组件，需安装 `jsdom` 或 `happy-dom` 并单独配置。本次计划优先覆盖纯函数单元测试，组件测试依赖手动/Playwright。
- 飞书授权异常提醒依赖 sync-calendar 接口返回的 `error.details.authorizeUrl`，已在前序提交中支持。

### 主要风险

1. **`hasReview` 在 in-memory repository 中的实现**：当前 in-memory `saveSessionReview` 不保存 review 记录，需要小心扩展，避免影响现有测试。
2. **首页并发请求性能**：如果有大量 generated 计划，首页会并发大量 `/api/plans/:id` 请求。MVP 阶段假设用户计划数量 ≤10，后续再优化。
3. **进度口径差异**：首页与 dashboard 进度计算方式不同，需在 UI 上保持一致的用户理解（两者都是“完成进度”，但一个按时间、一个按数量）。
4. **时区处理**：今日 session 按浏览器本地时区筛选，需与 dashboard 日历分组逻辑保持一致。

---

## 回滚策略

如首页改造后出现严重问题，可直接将 `app/page.tsx` 回滚到改造前版本（三个入口卡片），保留 `components/home/*` 文件不引用即可。后端 `hasReview` 字段为可选字段，不影响旧逻辑。
