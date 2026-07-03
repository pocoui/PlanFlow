# PlanFlow AI 实施计划

> **给智能体执行者的要求：** 实施本计划时，如果可用，必须使用 superpowers:subagent-driven-development；否则使用 superpowers:executing-plans。步骤使用复选框（`- [ ]`）语法，便于追踪。

**目标：** 构建 PlanFlow AI 三天 MVP：创建学习目标、配置每周可用时间、读取模拟飞书忙闲、生成 AI 风格任务、排入真实可用时间、复盘后顺延，并导出 `.ics`。

**架构：** 即使 MVP 很小，也要保持模块化。API 路由保持轻薄；AI 生成、日历 provider、可用时间计算、排程、复盘顺延、校验和日历导出放在独立模块中，并配套测试。

**技术栈：** Next.js App Router + React + TypeScript、Route Handlers、Prisma + PostgreSQL、Tailwind CSS + shadcn/ui、Zod、Vitest、Playwright、`.ics` 导出。

---

## 阶段 1：项目基础

### 任务 1：创建 Next.js 全栈应用骨架

**文件：**

- 创建根 package 和工作区配置。
- 创建 Next.js App Router 应用。
- 创建 `app/`、`components/`、`lib/`、`packages/` 和 `prisma/` 基础目录。
- 创建共享包：`packages/shared`。

- [ ] 创建 dev、build、test、lint、类型检查脚本。
- [ ] 添加 TypeScript 配置。
- [ ] 添加共享类型包。
- [ ] 安装依赖。
- [ ] 运行类型检查。
- [ ] 提交：`chore: scaffold typescript workspace`。

### 任务 2：添加 Prisma 和初始 schema

**文件：**

- 创建 `prisma/schema.prisma`。
- 创建 API 数据库 client 模块。

- [ ] 按 `docs/DATA_MODEL.md` 添加 schema。
- [ ] 生成 Prisma 客户端。
- [ ] 添加 seed 或模拟用户策略。
- [ ] 本地运行 migration。
- [ ] 提交：`feat: add prisma data model`。

## 阶段 2：核心领域逻辑

### 任务 3：可用时间校验

**文件：**

- 创建 `packages/shared/src/availability.ts`。
- 创建可用时间校验测试。

- [ ] 先写有效星期规则的失败测试。
- [ ] 先写重叠时间段的失败测试。
- [ ] 先写时间顺序非法的失败测试。
- [ ] 实现校验逻辑。
- [ ] 运行测试。
- [ ] 提交：`feat: validate weekly availability`。

### 任务 4：日历 provider 和真实可用时间计算

**文件：**

- 创建 `lib/calendar/calendarProvider.ts`。
- 创建 `lib/calendar/mockFeishuCalendarProvider.ts`。
- 创建 `packages/shared/src/availability-engine.ts`。
- 创建忙闲扣除测试。

- [ ] 定义 `CalendarProvider` 接口。
- [ ] 实现 `MockFeishuCalendarProvider`。
- [ ] 先写“从每周可用时间扣除忙碌时间”的失败测试。
- [ ] 先写“会议切分学习时间段”的失败测试。
- [ ] 先写“冲突后应用缓冲时间”的失败测试。
- [ ] 实现真实可用时间计算。
- [ ] 运行测试。
- [ ] 提交：`feat: add calendar provider availability engine`。

### 任务 5：排程算法

**文件：**

- 创建 `packages/scheduler/src/scheduler.ts`。
- 创建排程测试。

- [ ] 先写“只排到真实可用时间内”的失败测试。
- [ ] 先写“跳过禁用星期”的失败测试。
- [ ] 先写“同一天多个时间段”的失败测试。
- [ ] 先写“不与忙碌时间冲突”的失败测试。
- [ ] 先写“长任务拆分”的失败测试。
- [ ] 先写“可用时间不足”的失败测试。
- [ ] 实现确定性的最早可用时间排程器。
- [ ] 运行测试。
- [ ] 提交：`feat: schedule tasks by weekly availability`。

### 任务 6：AI 规划服务

**文件：**

- 创建 `lib/services/aiPlanningService.ts`。
- 创建模拟 AI 提供方。
- 创建输出校验测试。

- [ ] 定义输入和输出类型。
- [ ] 实现用于演示的模拟任务生成。
- [ ] 校验生成任务。
- [ ] 为后续真实 AI 添加提供方接口。
- [ ] 运行测试。
- [ ] 提交：`feat: add ai planning service boundary`。

### 任务 7：复盘和顺延引擎

**文件：**

- 创建 `lib/review/reviewEngine.ts`。
- 创建复盘顺延测试。

- [ ] 定义复盘输入和输出类型。
- [ ] 先写“部分完成后剩余分钟数进入待排程”的失败测试。
- [ ] 先写“未完成后整段任务顺延”的失败测试。
- [ ] 先写“顺延时应用自定义缓冲时间”的失败测试。
- [ ] 先写“截止日期前容量不足返回警告”的失败测试。
- [ ] 实现复盘和顺延逻辑。
- [ ] 运行测试。
- [ ] 提交：`feat: add review rescheduling engine`。

## 阶段 3：后端 API

### 任务 8：计划 API

**文件：**

- 在 `app/api` 中创建计划 Route Handlers，在 `lib/services` 中创建业务 services。
- 添加 Route Handler 和 service 测试。

- [ ] 实现 `POST /api/plans`。
- [ ] 实现 `POST /api/plans/:planId/generate`。
- [ ] 实现 `GET /api/plans/:planId`。
- [ ] 持久化计划、可用时间、忙碌时间、任务和日程。
- [ ] 运行 API 测试。
- [ ] 提交：`feat: add plan generation api`。

### 任务 9：复盘、状态更新和日历导出 API

**文件：**

- 添加任务和日程状态路由。
- 添加复盘路由。
- 添加忙闲查询路由。
- 添加日历导出服务。

- [ ] 实现任务状态更新。
- [ ] 实现日程状态更新。
- [ ] 实现 `POST /api/sessions/:sessionId/review`。
- [ ] 实现 `GET /api/plans/:planId/busy-slots`。
- [ ] 实现 `.ics` 导出。
- [ ] 测试有日程时的导出结果。
- [ ] 提交：`feat: add progress tracking and calendar export`。

## 阶段 4：前端 MVP

### 任务 10：计划创建和可用时间 UI

**文件：**

- 在 `app/` 和 `components/` 中创建 Next.js 页面和 React 组件。

- [ ] 构建计划创建表单。
- [ ] 构建星期可用时间编辑器。
- [ ] 添加冲突后缓冲时间设置，默认 15 分钟。
- [ ] 展示模拟飞书忙碌时间预览。
- [ ] 添加时间段新增和删除控件。
- [ ] 显示校验反馈。
- [ ] 接入创建和生成 API。
- [ ] 提交：`feat: add plan creation flow`。

### 任务 11：计划看板

**文件：**

- 创建看板、日历、任务列表和汇总组件。

- [ ] 展示计划汇总。
- [ ] 展示今日日程。
- [ ] 展示周日历视图。
- [ ] 在日历中区分学习日程和忙碌时间。
- [ ] 展示任务列表和状态。
- [ ] 添加完成操作。
- [ ] 添加日程结束后的复盘入口。
- [ ] 展示顺延后的日程变化。
- [ ] 添加日历导出操作。
- [ ] 提交：`feat: add learning plan dashboard`。

## 阶段 5：验证和交付

### 任务 12：端到端演示验证

- [ ] 运行全部测试。
- [ ] 运行类型检查。
- [ ] 运行构建。
- [ ] 启动开发服务。
- [ ] 用浏览器验证桌面端流程。
- [ ] 用浏览器验证移动端布局。
- [ ] 验证忙碌时间冲突会被扣除。
- [ ] 验证复盘未完成后会顺延。
- [ ] 修复可见布局问题。
- [ ] 提交：`test: verify mvp flow`。

### 任务 13：交付文档

**文件：**

- 更新 `README.md`。
- 如有需要，创建部署说明。
- 如有需要，创建面试讲解说明。

- [ ] 记录安装和启动命令。
- [ ] 记录演示脚本。
- [ ] 记录架构说明。
- [ ] 记录 MockFeishu 和真实飞书 provider 的切换方案。
- [ ] 提交：`docs: add delivery guide`。

## 三天执行顺序

第一天：

- 创建 Next.js 应用骨架。
- 添加数据模型。
- 实现可用时间校验。
- 实现 CalendarProvider 和 MockFeishu 忙闲。
- 实现真实可用时间计算。
- 实现排程算法。

第二天：

- 实现模拟 AI 服务。
- 实现复盘顺延引擎。
- 添加核心 Route Handlers。
- 添加 `.ics` 导出。

第三天：

- 构建前端创建流程。
- 构建看板和日历视图。
- 运行验证。
- 打磨 README 和面试说明。
