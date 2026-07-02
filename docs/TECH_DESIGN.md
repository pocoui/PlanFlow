# PlanFlow AI 技术设计

## 技术栈

- 前端：React + TypeScript + Vite
- 后端：Node.js + Express + TypeScript
- 数据库：Prisma + SQLite
- 测试：核心逻辑和前端单元测试使用 Vitest，API 测试使用 Supertest
- 日历导出：根据已排程日程生成 `.ics`
- AI 提供方：先使用模拟提供方，后续接入兼容 OpenAI 的提供方

## 仓库结构

计划结构：

```text
apps/
  web/
    src/
  api/
    src/
packages/
  shared/
    src/
  scheduler/
    src/
docs/
prisma/
```

两天 MVP 可以实现为一个 TypeScript 工作区。重点不是目录复杂度，而是保持 UI、API、AI 规划、排程算法和共享类型之间的职责边界。

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
- `scheduler`：根据任务和可用时间创建日程。
- `calendar`：导出 `.ics`。

Express 路由保持轻薄，业务逻辑放在 service 中。

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

真实提供方后续通过同一接口接入。

## 排程设计

排程器输入：

- 带预计分钟数和优先级的任务。
- 每周可用时间规则。
- 开始日期。
- 截止日期。

排程器输出：

- 已排程日程。
- 可用时间不足时未排完的任务分钟数。
- 排程警告。

规则：

- 永远不排到可用时间之外。
- 尊重未启用的星期。
- 支持同一天多个时间段。
- 当任务时长超过单个时间段时，允许拆成多个日程。
- 优先使用更早的可用时间段。
- 输出保持确定性，方便测试。

## 飞书日历策略

MVP：

- 导出 `.ics` 文件。
- 把飞书日历作为后续适配器方案写入文档。

后续：

- 添加飞书 OAuth 或应用凭证配置。
- 在 API 支持时查询忙闲信息。
- 为已排程日程创建飞书日历事件。
- 在 API 支持时同步完成状态或提醒信息。

这样即使第三方配置被卡住，项目依然可以完整演示。

## 部署

MVP 部署选项：

- 前端：Vercel 或静态托管。
- 后端：Render、Railway 或轻量 Node 服务。
- 数据库：本地演示用 SQLite；正式持久化部署后可迁移到 PostgreSQL。

环境变量：

- `DATABASE_URL`
- `AI_PROVIDER`
- `OPENAI_API_KEY`：启用真实 AI 时使用
- 飞书凭证：只在真实集成开始后添加

## 错误处理

- API 输入使用结构校验。
- 对校验错误、AI 解析错误、排程容量不足和导出失败返回类型化错误码。
- 面向用户的错误提示保持简洁。
- 记录提供方错误时不能泄露密钥。

## 安全说明

- 不要把 API key 暴露给前端。
- 实现飞书集成时，第三方 token 只保存在后端。
- MVP 可以使用模拟登录或单用户模式，但数据模型保留用户归属字段，方便后续迁移。
