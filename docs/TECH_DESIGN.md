# PlanFlow AI 技术设计

## 技术栈

- 全栈框架：Next.js App Router + React + TypeScript
- API 层：Next.js Route Handlers
- 数据库：Prisma + PostgreSQL
- UI：Tailwind CSS + shadcn/ui
- 校验：Zod
- 测试：核心逻辑使用 Vitest，主流程使用 Playwright
- 日历集成：通过 `CalendarProvider` 抽象读取忙闲、创建外部日历事件；MVP 使用 MockFeishu 忙闲
- 日历导出：根据已排程日程生成 `.ics` 作为兜底能力
- AI 提供方：先使用模拟提供方，后续接入兼容 OpenAI 的提供方

## 仓库结构

计划结构：

```text
app/
  api/
  plans/
  dashboard/
components/
lib/
packages/
  shared/
    src/
  scheduler/
    src/
docs/
prisma/
```

三天 MVP 使用完整 Next.js App Router 项目结构。重点不是把前后端拆成两个服务，而是在一个 Next.js 全栈应用中保持页面、API、AI 规划、排程算法和共享类型之间的职责边界。

## 前端架构

核心页面：

- 计划创建页
- 每周可用时间编辑器
- 生成结果看板
- 日历视图
- 任务列表视图

核心前端模块：

- `PlanForm`：填写学习目标、总时长、开始日期和截止日期。
- `WeeklyAvailabilityEditor`：编辑按星期配置的可用时间段。
- `CalendarView`：展示已排程日程。
- `TaskList`：展示生成任务和任务状态。
- `PlanSummary`：展示进度和容量信息。
- API client 模块：封装后端请求。

MVP 阶段保持状态管理简单：

- 表单编辑使用组件本地状态。
- 服务端数据通过 API 请求获取。
- 除非实现确实需要，否则不引入全局状态库。

## 后端架构

核心模块：

- `plans`：创建和读取学习计划。
- `availability`：校验并保存每周可用时间规则。
- `ai`：生成结构化学习任务。
- `calendarProvider`：读取飞书忙闲，后续创建或更新飞书日历事件。
- `availabilityEngine`：把每周可用时间扣除忙碌时间，得到真实可用时间。
- `scheduler`：根据任务和真实可用时间创建日程。
- `review`：记录学习复盘并计算顺延任务。
- `calendar`：导出 `.ics`。

Route Handlers 保持轻薄，业务逻辑放在 service 中。第一版不额外引入 Express 或 NestJS，避免增加跨服务联调、CORS 和部署复杂度；后续业务复杂度上升时，可以把 `lib/services` 中的逻辑迁移到独立 Node/NestJS 服务。

### Prisma Client 调用链路

#### 初始化与配置

Prisma Client 采用全局单例模式，防止 Next.js Hot Reload 时重复创建连接：

```
lib/db/prisma.ts
    ↓
globalThis.prisma 单例（开发环境持久化）
    ↓
PrismaClient({ log: ["query", "error", "warn"] })
    ↓
读取 .env 中的 DATABASE_URL
```

**文件：** `lib/db/prisma.ts`

#### 调用层级

```
API Route (app/api/**/route.ts)
    ↓
getRepository() → 获取仓库实例
    ↓
PlanService 函数 (lib/services/planService.ts)
    ↓
createPrismaPlanRepository() → Prisma Client 操作
    ↓
PostgreSQL 数据库
```

#### Prisma 操作清单

| 操作类型 | Prisma 调用 | 对应服务 |
|---------|------------|---------|
| 创建 | `prisma.user.upsert` | 用户管理 |
| 创建 | `prisma.learningPlan.create` | 创建计划 |
| 查询 | `prisma.learningPlan.findUnique` | 获取计划详情 |
| 查询 | `prisma.learningPlan.findMany` | 列出计划 |
| 删除 | `prisma.learningPlan.delete` | 删除计划 |
| 事务 | `prisma.$transaction` | 生成计划、保存任务、保存排程、提交复盘 |
| 更新 | `prisma.learningTask.update` | 更新任务状态 |
| 更新 | `prisma.scheduledSession.update` | 更新会话状态 |
| 查询 | `prisma.scheduledSession.findUnique` | 获取会话上下文 |

#### 数据模型

| 模型 | 用途 |
|------|------|
| `User` | 用户 |
| `LearningPlan` | 学习计划（核心） |
| `AvailabilityRule` | 可用时间规则 |
| `LearningTask` | 学习任务 |
| `ScheduledSession` | 排程会话 |
| `BusySlot` | 忙碌时间段 |
| `SessionReview` | 会话复盘 |

#### 枚举类型

| 枚举 | 值 |
|------|----|
| `PlanStatus` | `draft`, `generated`, `archived` |
| `TaskStatus` | `not_started`, `in_progress`, `completed`, `delayed` |
| `SessionStatus` | `scheduled`, `completed`, `missed`, `rescheduled`, `conflicted` |
| `ReviewResult` | `completed`, `partial`, `not_completed`, `skipped` |

#### Repository 工厂模式

`lib/server/repository.ts` 根据环境变量决定使用哪种仓库：

```typescript
if (process.env.DATABASE_URL) {
  return createPrismaPlanRepository();  // PostgreSQL
} else {
  return createInMemoryPlanRepository(); // 内存存储（开发/测试用）
}
```

这样开发环境可以不配置数据库直接运行，测试时使用内存仓库避免数据库依赖。

## AI 设计

AI 服务暴露接口：

```ts
generateLearningTasks(input: GenerateLearningTasksInput): Promise<GeneratedTask[]>
```

服务必须做到：

- 接收计划目标和目标总分钟数。
- 返回结构化任务。
- 返回前校验输出结构。
- 支持用于开发和测试的模拟实现。
- 支持通过 OpenAI 兼容接口调用真实 AI Agent。

### AI Provider 架构

```
AiPlanningProvider (接口)
├── MockAiPlanningProvider — 内置示例任务，无需 API Key
└── OpenAiCompatibleProvider — 调用兼容 OpenAI Chat Completions 的 Agent API
    支持：OpenAI、DeepSeek、Kimi、Ollama 等
    配置项：baseUrl / model / apiKey
```

Provider 选择策略：

- 通过 `GET/PUT /api/settings/ai` 配置 `provider` 字段。
- `provider: "mock"` → 使用 `MockAiPlanningProvider`。
- `provider: "openai_compatible"` 且 `baseUrl` + `apiKey` 非空 → 使用 `OpenAiCompatibleProvider`。
- 配置缺失或无效时，降级为 `MockAiPlanningProvider`。

配置存储：

- 服务端内存（globalThis），防止 HMR 重置，重启后重新从环境变量加载。
- 环境变量 `AI_PROVIDER`、`OPENAI_BASE_URL`、`OPENAI_MODEL`、`OPENAI_API_KEY` 作为默认值。
- 前端设置页 `/settings` 可实时修改配置，API Key 脱敏返回（仅展示前4后4位）。

## 排程设计

排程器输入：

- 带预计分钟数和优先级的任务。
- 扣除外部忙碌时间后的真实可用时间。
- 开始日期。
- 截止日期。
- 冲突后缓冲时间，单位为分钟。

排程器输出：

- 已排程日程。
- 可用时间不足时未排完的任务分钟数。
- 排程警告。

规则：

- 永远不排到可用时间之外。
- 永远不与飞书忙碌时间冲突。
- 当学习任务因忙碌时间冲突而顺延时，新日程开始时间必须晚于忙碌时间结束时间加缓冲时间。
- 尊重未启用的星期。
- 支持同一天多个时间段。
- 当任务时长超过单个时间段时，允许拆成多个日程。
- 优先使用更早的可用时间段。
- 输出保持确定性，方便测试。

## 日历集成策略

核心抽象：

```ts
interface CalendarProvider {
  getBusySlots(input: GetBusySlotsInput): Promise<BusySlot[]>
  createCalendarEvent(input: CreateCalendarEventInput): Promise<ExternalCalendarEvent>
  updateCalendarEvent(input: UpdateCalendarEventInput): Promise<ExternalCalendarEvent>
}
```

MVP：

- 实现 `MockFeishuCalendarProvider`，模拟会议和忙碌时间。
- 排程前先获取计划日期范围内的忙碌时间。
- 由 `availabilityEngine` 从用户每周可用时间中扣除忙碌时间。
- 支持计划级 `rescheduleBufferMinutes`，默认 15 分钟，用于控制冲突后多久可以重新开始学习。
- 导出 `.ics` 文件作为兜底能力。

后续：

- 添加飞书 OAuth 或应用凭证配置。
- 在 API 支持时查询忙闲信息。
- 为已排程日程创建飞书日历事件。
- 在 API 支持时同步完成状态或提醒信息。

这样即使第三方配置被卡住，项目依然可以完整演示。

## 复盘和顺延设计

每个学习日程结束后，用户提交复盘：

- 完成状态：已完成、部分完成、未完成、跳过
- 实际学习分钟数
- 未完成原因
- 剩余分钟数

`reviewEngine` 根据复盘结果处理：

- 已完成：关闭对应日程，更新任务进度。
- 部分完成：把剩余分钟数重新放回待排程队列。
- 未完成或跳过：把原日程时长重新放回待排程队列。
- 顺延：从当前时间之后查找真实可用时间，重新生成后续日程。
- 顺延时应用 `rescheduleBufferMinutes`，例如冲突日程结束 15 分钟后再开始学习。

复盘和顺延必须保持确定性，方便测试，也方便面试讲解。

## 部署

MVP 部署选项：

- 前端：Vercel 或静态托管。
- 应用：优先部署到 Vercel。
- 数据库：本地和线上都以 PostgreSQL 为目标；本地可使用 Docker PostgreSQL 或托管 PostgreSQL 开发库。

环境变量：

- `DATABASE_URL`
- `AI_PROVIDER`：`mock`（默认）或 `openai_compatible`
- `OPENAI_BASE_URL`：Agent API 基础地址，如 `https://api.openai.com/v1`
- `OPENAI_MODEL`：模型名称，如 `gpt-4o`
- `OPENAI_API_KEY`：API 密钥
- 飞书凭证：只在真实 provider 集成开始后添加

## 错误处理

- API 输入使用结构校验。
- 对校验错误、AI 解析错误、忙闲获取失败、排程容量不足、复盘顺延失败和导出失败返回类型化错误码。
- 面向用户的错误提示保持简洁。
- 记录提供方错误时不能泄露密钥。

## 安全说明

- 不要把 API key 暴露给前端。
- 实现飞书集成时，第三方 token 只保存在后端。
- MVP 可以使用模拟登录或单用户模式，但数据模型保留用户归属字段，方便后续迁移。
