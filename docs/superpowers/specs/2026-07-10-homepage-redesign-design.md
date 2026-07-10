# PlanFlow AI 首页改造设计文档

## 1. 背景与目标

### 1.1 当前问题

当前首页（`/`）是一个功能入口聚合页，展示三个等权卡片：创建学习计划、学习日历、任务管理。存在以下产品问题：

- 三个入口权重相同，但“学习日历”“任务管理”在 MVP 阶段标注为“后续实现”，容易误导用户。
- 用户打开首页后，无法第一时间知道“今天该学什么”“计划进度如何”。
- 缺少异常状态提醒（飞书授权过期、待复盘日程等）。
- 空状态处理较弱，新用户决策成本高。

### 1.2 设计目标

把首页从「功能导航页」升级为「今日学习仪表盘」，承担以下产品角色：

1. **决策中枢**：3 秒内让用户知道今天是否有学习任务、是什么。
2. **进度仪表**：展示进行中的计划进度和下一步学习安排。
3. **行动提醒**：推送待复盘、飞书授权异常、排程冲突等关键状态。
4. **快速入口**：提供创建计划、查看日历、导出 `.ics` 等高频操作。

## 2. 方案概述

### 2.1 选型

采用「**仅改造现有首页，保留 `/dashboard` 独立存在**」的方案。

理由：

- 改动范围可控，不破坏现有 dashboard 的完整看板能力。
- 职责清晰：`/` 负责「第一眼价值」和快捷入口；`/dashboard` 负责「按周浏览、复盘、导出」等深度管理。
- 适合 MVP 阶段快速验证，后续可再决定是否合并。

### 2.2 与现有系统的关系

```
/                    → 今日仪表盘（本次改造）
├── 今日学习卡片
├── 进行中的计划
├── 待处理提醒
└── 快捷操作

/dashboard           → 完整计划看板（保持现有功能）
├── 计划切换
├── 周日历 / 列表视图
├── 复盘弹窗
└── 导出 / 同步操作

/plans/new           → 创建学习计划流程（保持现有功能）
```

## 3. 页面结构

首页采用单栏布局，内容区域最大宽度 `max-w-4xl`，在小屏幕下保持 `px-4` 内边距。项目根布局 [app/layout.tsx](file:///d:/frontend-program/ai/PlanFlow/app/layout.tsx) 已使用 `AppShell` 包裹所有页面，因此本次改造无需改动布局，只需替换 `app/page.tsx` 主内容区。

响应式约定：

- 桌面端（≥640px）：单栏内容区居中，模块卡片正常展开，快捷操作按钮横向排列。
- 移动端（<640px）：内容区全宽，模块卡片内操作按钮纵向堆叠或换行，快捷操作按钮横向滚动或换行。
- 所有模块间距使用 `gap-6` / `mb-6` 保持一致。

模块从上到下依次为：

1. 顶部问候区
2. 今日学习（最高优先级）
3. 进行中的计划
4. 待处理提醒
5. 快捷操作

## 4. 状态设计

### 4.1 状态 A：冷启动（无计划）

触发条件：`GET /api/plans` 返回空数组。

展示内容：

| 元素 | 内容 |
|---|---|
| 主标题 | 把学习目标，排进你的真实日历 |
| 副标题 | 输入学习目标，AI 自动拆解任务，并结合飞书忙闲生成可执行学习日程 |
| 主 CTA | 「创建学习计划」按钮，跳转 `/plans/new` |
| 流程预览 | 3 步图标说明：输入目标 → AI 拆解 → 同步日历 |
| 飞书提示 | 说明后续可授权飞书读取忙闲并同步日历 |

> 注：示例计划快速填充属于第二步迭代功能，第一步不实现。空状态仅展示价值主张、流程预览和创建 CTA。

### 4.2 状态 B：已有计划（核心状态）

触发条件：`GET /api/plans` 返回非空数组。

#### 4.2.0 有计划但无进行中的计划

如果用户已有计划，但所有计划状态均为 `draft` 或 `archived`（即没有 `status === "generated"` 的计划）：

- 顶部问候区正常展示。
- 「今日学习」模块展示空状态：「暂无已生成的学习日程，先生成一个计划吧」。
- 「进行中的计划」模块展示空状态 + 「创建学习计划」CTA。
- 「待处理提醒」模块不展示。
- 「快捷操作」模块保留「创建学习计划」和「学习日历」，「导出 .ics」置灰。

#### 4.2.1 顶部问候区

- 问候语：根据当前时间显示「早上好 / 下午好 / 晚上好，准备好学习了吗？」。时间分界：05:00~11:59 为早上，12:00~17:59 为下午，18:00~04:59 为晚上。
- 日期与日程数量：例如「今天是 2026年7月10日，你有 1 个学习日程」

#### 4.2.2 今日学习卡片

展示规则：

- 仅取 `status === "generated"` 的计划中的 session，避免 `draft` 或 `archived` 计划干扰今日视图。session 归属日期以 `startAt` 的本地日期为准；本地日期使用用户浏览器时区（`new Date(startAt).getFullYear()/getMonth()/getDate()`），与现有 dashboard 日历分组逻辑保持一致。跨天 session（如前一日 23:00 开始、今日 01:00 结束）按 `startAt` 日期展示，不重复出现在两天中。
- 筛选 `status` 为 `scheduled` 或 `conflicted` 的 session 优先展示；已完成/已错过/已顺延的 session 不在今日学习卡片中展示。
- 按 `startAt` 升序排列。
- 最多展示 3 条，超出时显示「还有 N 个日程」入口，跳转 `/dashboard`。

后端 SessionStatus 枚举为：`scheduled` | `completed` | `missed` | `rescheduled` | `conflicted`。首页仅关注以下展示状态：

| 展示状态 | 对应后端状态 | 说明 |
|---|---|---|
| 未开始 | `scheduled` | 尚未到达开始时间 |
| 进行中 | `scheduled` | 当前时间处于 `startAt` 与 `endAt` 之间 |
| 冲突 | `conflicted` | 与飞书日程冲突，需要重新排程 |
| 已完成 | `completed` | 已完成，不展示在今日学习卡片 |
| 已跳过 | `missed` | 已标记跳过，不展示 |
| 已顺延 | `rescheduled` | 已被复盘顺延，不展示 |

操作按钮映射：

| 展示状态 | 操作 |
|---|---|
| 未开始 | 跳过 |
| 进行中 | 标记完成 |
| 冲突 | 查看冲突 / 重新排程 |

> 注：MVP 第一步不实现「开始专注」计时功能。未开始 session 仅提供「跳过」，进行中 session 提供「标记完成」。后续如需专注计时，可作为增强功能实现。

空状态：

> 今天没有安排学习任务，好好休息或提前开启明天的学习。

#### 4.2.3 进行中的计划卡片

展示规则：

- 后端 PlanStatus 枚举为：`draft` | `generated` | `archived`。
- 首页「进行中的计划」仅取 `status === "generated"` 的计划；`draft` 和 `archived` 状态的计划不展示。
- 按 `createdAt` 倒序排列，最近创建的计划排在前面。
- 最多展示 2 个计划，超出时显示「查看全部计划」入口，跳转 `/dashboard`。

卡片字段：

| 字段 | 说明 |
|---|---|
| 计划标题 | `plan.title` |
| 进度条 | `completedMinutes / totalMinutes`。当 `totalMinutes === 0` 时进度按 0% 展示，避免除零。进度百分比 = `Math.min(100, totalMinutes > 0 ? Math.round((completedMinutes / totalMinutes) * 100) : 0)`，取值范围 0~100 |
| 进度百分比 | 与进度条一致，例如「42%」；总时长为 0 时显示「0%」。注意：首页进度基于已完成 session 的计划分钟数 / 计划总分钟数，而现有 dashboard `summarizeGeneratedPlan` 基于已完成 session 数 / 总 session 数，两者口径不同；MVP 阶段首页采用分钟口径以反映真实学习时长占比 |
| 已完成时长 | `completedMinutes` 和 `totalMinutes` 均转换为小时展示，保留 1 位小数，例如「已完成 12.6 / 30.0 小时」。转换公式：`Math.round((minutes / 60) * 10) / 10`。当 `totalMinutes === 0` 时显示「已完成 0.0 / 0.0 小时」。注意：首页进度基于 session 的计划时长（`durationMinutes`），而非复盘时填写的 `actualMinutes`，因此可能与真实学习时长有偏差；MVP 阶段采用此口径以简化计算，后续可考虑引入复盘实际时长 |
| 下次学习 | 优先取当前进行中的 session（`status === "scheduled"` 且 `startAt <= now <= endAt`），展示为「进行中：HH:mm - HH:mm」。若无进行中 session，再取 `status === "scheduled"` 且 `startAt > now` 的最近一个 session，展示其开始时间。都没有则显示「暂无后续安排」 |
| 快捷操作 | 查看日历 / 导出 .ics |

#### 4.2.4 待处理提醒区

按优先级展示以下提醒（可同时存在多条）：

| 类型 | 聚合策略 | 触发条件 | 数据源 | 操作 |
|---|---|---|---|---|
| 待复盘 | 按 session 拆分，每个待复盘 session 展示一条提醒 | 存在 `status === "completed"` 且 `hasReview === false` 的 session | 通过 `GET /api/plans/:id` 获取 sessions；需要在 API 返回的 session 对象中新增 `hasReview: boolean` 字段 | 去复盘（跳转 `/dashboard?planId=xxx&reviewSessionId=sessionId`） |
| 飞书授权异常 | 按 plan 聚合，每个触发同步失败的 plan 展示一条 | 用户在首页点击「同步飞书」后，调用 `POST /api/plans/:id/sync-calendar` 返回 401 且 `error.code === "FEISHU_AUTH_REQUIRED"` | 同步操作失败响应中的 `error.details.authorizeUrl` | 重新授权（浏览器直接访问该 `authorizeUrl`，在当前窗口跳转） |
| 排程冲突 | 按 plan 聚合，每个存在冲突 session 的 plan 展示一条 | 存在 `status === "conflicted"` 的 session | 通过 `GET /api/plans/:id` 获取 sessions | 重新排程（跳转 `/dashboard?planId=xxx`） |

> 聚合策略说明：
> - 待复盘需要精确到具体 session，因为用户需要逐个提交复盘，所以按 session 拆分。
> - 飞书授权异常和排程冲突按 plan 聚合，因为解决一次授权或排程问题即可影响整个 plan，无需按 session 展示。

> 产品说明：飞书授权异常提醒仅在用户主动触发同步失败后出现。首页不主动调用同步接口，避免首次加载时的网络开销和授权弹窗干扰。若用户未触发同步，即使 token 已过期，首页也不展示该提醒。授权跳转直接使用同步失败响应中的 `authorizeUrl`。
>
> 注：
> - 第一步实现「待复盘」和「飞书授权异常」提醒。
> - 「待复盘」需要后端在 `GET /api/plans/:id` 返回的 session 中增加 `hasReview: boolean` 字段。该字段为 API 层计算字段：
>   - Prisma 侧：在 `planInclude.sessions` 中增加 `{ include: { review: true } }`，`mapPrismaSession` 根据 `session.review !== null` 计算 `hasReview`。
>   - In-memory 侧：当前 `saveSessionReview` 未在 session 上保存 review 记录，需扩展 in-memory session 结构以支持 `hasReview` 计算，确保无 `DATABASE_URL` 时功能一致。
>   - 同步更新 `ScheduledSessionRecord`、`DashboardSession` 等 TypeScript 类型。
> - 「排程冲突」提醒依赖 `conflicted` 状态的 session，该状态已在后端定义但当前 scheduler 可能未实际生成；如未生成，作为第二步实现。

展示样式：

- 每条提醒使用带颜色边框的卡片（警告用 amber，错误用 red，信息用 blue）。
- 图标 + 文案 + 操作按钮，一行内完成。

#### 4.2.5 快捷操作区

按钮组合：

| 操作 | 行为 |
|---|---|
| + 创建学习计划 | 跳转 `/plans/new` |
| 学习日历 | 跳转 `/dashboard` |
| 导出 .ics | 默认导出「进行中的计划」中排序第一个（即 `createdAt` 最新的 `status === "generated"` 计划）的 `.ics` 文件；当没有进行中的计划，或进行中的计划没有任何 `scheduled`/`completed` 状态的 session 时，按钮置灰并提示「暂无可导出日程」 |

## 5. 数据需求与 API 对接

### 5.1 已有 API 复用

> 注：下表使用 `:id` 作为路径参数简写，实际对应 Next.js 动态路由 `[planId]` / `[sessionId]`。

| 数据 | API | 说明 |
|---|---|---|
| 计划列表 | `GET /api/plans` | 获取所有计划基础信息 |
| 计划详情 | `GET /api/plans/:id` | 获取单个计划的 tasks、sessions、busySlots、progress；本次需在 session 对象中新增 `hasReview: boolean` |
| 标记完成 | `PATCH /api/sessions/:id/status` | 把 session 标记为 completed |
| 提交复盘 | `POST /api/sessions/:id/review` | 提交复盘结果 |
| 导出 .ics | `GET /api/plans/:id/calendar.ics` | 下载日历文件 |
| 同步飞书 | `POST /api/plans/:id/sync-calendar` | 触发飞书同步 |
| 飞书授权 | `GET /api/auth/feishu/authorize?planId=xxx` | 已支持 `planId` 查询参数，用于 OAuth state；授权完成后回调到 `/dashboard?planId=xxx`。首页飞书授权异常提醒直接使用 sync-calendar 失败响应中的 `authorizeUrl`，不再二次调用此端点 |

### 5.2 首页聚合数据逻辑

MVP 第一步不新增服务端聚合接口，直接在前端聚合数据。聚合后的内部数据结构如下：

```ts
interface HomeData {
  hasPlans: boolean;
  plans: HomePlanSummary[];
  todaySessions: HomeTodaySession[];
  pendingAlerts: HomeAlert[];
}

interface HomePlanSummary {
  id: string;
  title: string;
  status: "draft" | "generated" | "archived";
  totalMinutes: number;
  completedMinutes: number;
  progressPercent: number; // 0~100
  nextSession: {
    id: string;
    taskTitle: string; // 从 plan.tasks 中根据 session.taskId 查找 task.title
    startAt: string;
    endAt: string;
  } | null;
}

interface HomeTodaySession {
  id: string;
  planId: string;
  planTitle: string;
  taskId: string;
  taskTitle: string;
  startAt: string;
  endAt: string;
  status: "scheduled" | "conflicted";
}

interface HomeAlert {
  type: "review" | "feishu_auth" | "conflict";
  message: string;
  actionLabel: string;
  planId: string;
  sessionId?: string; // review 类型时必填
  action: {
    kind: "href" | "authorize";
    payload?: string; // href 时为 URL，authorize 时为 planId
  };
}
```

聚合步骤：

1. 调用 `GET /api/plans` 获取计划列表。
2. 对返回的计划并发调用 `GET /api/plans/:id` 获取详情（仅针对 `status === "generated"` 的计划）。
3. 计算字段：
   - `completedMinutes` = 该计划下所有 `status === "completed"` 的 session 的 `durationMinutes` 之和；`totalMinutes === 0` 时按 0 处理。
   - `progressPercent` = `Math.min(100, totalMinutes > 0 ? Math.round((completedMinutes / totalMinutes) * 100) : 0)`。
   - `nextSession.taskTitle` 通过 `session.taskId` 在 `plan.tasks` 中查找对应 task 的 `title` 得到；找不到时展示为空字符串。
   - 今日 session 按本地日期筛选，仅保留 `scheduled` 或 `conflicted` 状态，按 `startAt` 升序排列。
   - 待复盘提醒取 `status === "completed"` 且 `hasReview === false` 的 session。

### 5.3 API 依赖清单

| 端点 | 当前状态 | 本次是否需要改造 |
|---|---|---|
| `GET /api/plans` | 已存在 | 否，复用 |
| `GET /api/plans/:id` | 已存在 | 是，需在 session 对象中增加 `hasReview: boolean` |
| `PATCH /api/sessions/:id/status` | 已存在 | 否，复用 |
| `POST /api/sessions/:id/review` | 已存在 | 否，复用 |
| `GET /api/plans/:id/calendar.ics` | 已存在 | 否，复用 |
| `POST /api/plans/:id/sync-calendar` | 已存在 | 否，复用 |
| `GET /api/auth/feishu/authorize?planId=xxx` | 已存在，已支持 `planId` 查询参数 | 否，复用 |
| `buildCalendarExportUrl(planId)` | 已存在于 `lib/client/planDashboard.ts` | 否，复用 |

> 注：改造 `GET /api/plans/:id` 时，需同时更新 TypeScript 类型 `ScheduledSessionRecord` / `DashboardSession` 以及 in-memory 和 Prisma repository 的 `mapSession` 逻辑。

### 5.4 并发请求部分失败策略

首屏 `GET /api/plans` 失败时：进入整体错误状态，展示错误提示卡片和「重试」按钮，不展示任何模块内容。

对多个 `generated` 计划并发调用 `GET /api/plans/:id` 时：

- 若所有请求都失败：进入整体错误状态，展示错误提示卡片和「重试」按钮。
- 若部分请求失败：降级展示成功获取的计划数据，跳过失败计划；在页面顶部展示一行警告文案「部分计划加载失败」，不阻塞其他模块展示。
- 重试时仅重新调用失败的请求，已成功的数据保留。

## 6. 组件拆分

遵循「大组件按职责拆分」的工程约定，首页拆分为以下组件：

```
components/home/
├── home-page.tsx           # 首页主容器，负责数据加载和状态分发
├── empty-home.tsx          # 空状态组件
├── today-sessions.tsx      # 今日学习列表
├── plan-progress-card.tsx  # 单个计划进度卡片
├── pending-alerts.tsx      # 待处理提醒列表
└── quick-actions.tsx       # 快捷操作按钮组
```

### 6.1 职责说明

| 组件 | 职责 |
|---|---|
| `home-page.tsx` | 调用 API 加载数据，管理 loading / error / empty 状态，组合子组件 |
| `empty-home.tsx` | 展示价值主张、流程预览、创建 CTA |
| `today-sessions.tsx` | 渲染今日 session 列表，处理不同状态的操作按钮 |
| `plan-progress-card.tsx` | 渲染单个计划的进度条、下次学习、快捷操作 |
| `pending-alerts.tsx` | 渲染提醒卡片，根据类型分发操作 |
| `quick-actions.tsx` | 渲染创建/日历/导出按钮 |

## 7. 交互设计

### 7.1 今日学习操作

- **跳过**：调用 `PATCH /api/sessions/:id/status` 将状态更新为 `missed`，成功后刷新首页数据。
- **标记完成**：调用 `PATCH /api/sessions/:id/status` 将状态更新为 `completed`，成功后直接跳转 `/dashboard?planId=xxx&reviewSessionId=sessionId` 并自动打开复盘弹窗（由 dashboard 现有的复盘逻辑接管；需要 dashboard 支持从 URL 读取 `reviewSessionId` 并设置弹窗状态）。
- **去复盘**：跳转 `/dashboard?planId=xxx&reviewSessionId=sessionId` 并自动打开复盘弹窗。
- **dashboard 对 `reviewSessionId` 的异常降级**：若 URL 中的 `reviewSessionId` 在当前 plan 的 sessions 中不存在、或该 session 已经提交复盘（`hasReview === true`），则忽略该参数，正常展示 dashboard 不打开弹窗。
- **查看冲突 / 重新排程**：跳转 `/dashboard?planId=xxx`。
- **自动进行中**：如果当前时间已处于某个 `scheduled` session 的时间区间内，该 session 在首页显示「进行中」标签。

### 7.2 快捷操作

- **创建学习计划**：跳转 `/plans/new`。
- **学习日历**：跳转 `/dashboard`。
- **导出 .ics**：使用 `buildCalendarExportUrl(planId)` 生成下载链接。

### 7.3 待处理提醒

- **待复盘**：点击后跳转 `/dashboard?planId=xxx&reviewSessionId=sessionId` 并自动打开复盘弹窗。
- **飞书授权异常**：点击后浏览器直接访问同步失败响应中的 `authorizeUrl`，在当前窗口跳转。授权完成后回调到 `/dashboard?planId=xxx`。
- **排程冲突**：点击后跳转 `/dashboard?planId=xxx`。

## 8. 空状态与错误状态

### 8.1 空状态

- 无计划时展示 `empty-home.tsx`。
- 今日无学习日程时，在「今日学习」模块内展示空状态文案，不隐藏整个模块。

### 8.2 错误状态

- API 加载失败时，展示错误提示卡片和「重试」按钮，点击后重新调用 `loadHomeData()`。错误文案优先使用 API 返回的 `error.message`，降级为「加载失败，请重试」。
- 单个操作（如标记完成、跳过）失败时，在该操作按钮旁或卡片底部展示行内错误文案（例如「操作失败，请重试」）。错误来源：
  - 网络错误：展示「网络异常，请检查连接后重试」。
  - API 业务错误（4xx/5xx）：展示 API 返回的 `error.message` 或通用文案「操作失败，请重试」。
  - 不区分具体业务错误码，统一使用可读文案。
- 页面级未捕获异常由 Next.js 默认 error boundary 处理，本次不新增全局 error boundary。

### 8.3 加载状态

- 首页整体加载使用骨架屏（skeleton），避免布局抖动。骨架屏按模块结构占位：
  - 顶部问候区：两行灰色圆角条（标题 + 副标题）。
  - 今日学习：一个带圆角的卡片骨架，包含三行内容占位。
  - 进行中的计划：一个带圆角的卡片骨架，包含标题、进度条、两行文本文本占位。
  - 待处理提醒：一个带圆角的卡片骨架。
  - 快捷操作：三个圆角按钮骨架。
- 单个操作按钮点击后显示 loading 状态（按钮内显示 spinner 或文案变「处理中...」）。

## 9. 测试要点

- 无计划时展示空状态、价值主张、流程预览和创建 CTA。
- 有计划时正确跨计划聚合今日 session、计划进度、待处理提醒。
- 今日 session 按本地日期和时间排序，状态标签和操作按钮正确映射。
- 跨天 session 按 `startAt` 日期归属，不重复展示。
- 进度百分比和已完成时长计算正确（分钟转小时，保留 1 位小数）。
- `totalMinutes === 0` 时进度按 0% 展示，不崩溃。
- `completed` 且 `hasReview === false` 的 session 生成待复盘提醒，并携带正确的 `reviewSessionId`。
- 待复盘提醒在 in-memory repository（无 `DATABASE_URL`）和 Prisma repository 下均能正确识别。
- 飞书授权异常提醒可正确触发授权跳转。
- 标记完成、跳过等操作成功后刷新首页数据。
- 无进行中的计划或无可导出 session 时，导出按钮置灰。
- 空状态、加载状态、错误状态均可见。

## 10. MVP 落地范围

### 10.1 第一步（本次开发：首页 + 依赖改造）

本次改造以首页为核心，但涉及少量后端 API 和 dashboard 的联动调整：

1. 改造 `app/page.tsx` 为新的首页仪表盘。
2. 新增 `components/home/*` 组件。
3. 复用现有 API 在前端聚合首页数据。
4. 扩展 `GET /api/plans/:id` 返回的 session 对象，增加 `hasReview: boolean` 字段（同时影响 in-memory 和 Prisma repository）。
5. 改造 `app/dashboard/page.tsx`，支持从 URL 查询参数 `reviewSessionId` 自动打开复盘弹窗。
6. 实现空状态（价值主张 + 流程预览 + 创建 CTA）、今日学习、计划进度、快捷操作。
7. 实现待处理提醒中的「待复盘」和「飞书授权异常」（「排程冲突」提醒放到第二步，因 scheduler 可能未生成 `conflicted` session）。
8. 实现加载骨架屏和错误重试。

### 10.2 第二步（后续迭代）

1. 视性能需求，将首页聚合逻辑迁移到服务端 `GET /api/home`。
2. 增加示例计划快速填充功能。
3. 增加「排程冲突」提醒（需先确认 scheduler 是否生成 `conflicted` 状态 session）。
4. 优化动效和空状态插画。
