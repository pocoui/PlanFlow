# PlanFlow AI

PlanFlow AI 是一个 AI 学习计划与日历排程助手。用户输入学习目标，配置每周可学习时间，系统生成结构化学习任务，并把任务安排到真实可执行的日历时间段里。

## MVP 方向

第一版重点实现：

- 创建学习目标
- 按星期配置可用时间规则
- AI 风格的任务拆解
- 确定性的排程算法
- 日历看板
- `.ics` 日历导出

真实飞书日历同步是后续增强能力。MVP 需要在只有 `.ics` 导出的情况下依然可以完整演示。

## 计划技术栈

- Next.js App Router + React + TypeScript
- Next.js Route Handlers
- Prisma + PostgreSQL
- Tailwind CSS + shadcn/ui
- Zod
- Vitest 和 Playwright

## 当前状态

项目目前处于文档和计划阶段，尚未创建应用代码。

## 文档

- [PRD](docs/PRD.md)
- [技术设计](docs/TECH_DESIGN.md)
- [API 规格](docs/API_SPEC.md)
- [数据模型](docs/DATA_MODEL.md)
- [实施计划](docs/IMPLEMENTATION_PLAN.md)
- [测试计划](docs/TEST_PLAN.md)

## 面试定位

PlanFlow AI 不是普通 Todo 应用。它展示的是：如何把自然语言学习目标转成结构化任务，如何围绕不均匀的每周可用时间做排程，以及如何把结果导出到真实日历工作流。
