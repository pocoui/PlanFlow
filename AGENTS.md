# AGENTS.md

PlanFlow AI 当前是一个文档优先的 TypeScript 全栈项目。应用代码尚未创建。

## 当前仓库状态

- Git 已初始化。
- 计划文档位于 `docs/`。
- 计划技术栈为 Next.js App Router + React + TypeScript、Route Handlers、Prisma + PostgreSQL、Tailwind CSS + shadcn/ui、Zod、Vitest 和 Playwright。
- 当前还没有 `package.json`、锁文件、构建脚本、lint 脚本、测试脚本或源码目录。

## 工作规则

- 不要编造仓库配置里不存在的命令。
- 开始实现前先阅读：
  - `docs/PRD.md`
  - `docs/TECH_DESIGN.md`
  - `docs/API_SPEC.md`
  - `docs/DATA_MODEL.md`
  - `docs/IMPLEMENTATION_PLAN.md`
  - `docs/TEST_PLAN.md`
- AI 规划、排程算法、日历导出、API 路由和 UI 组件要按职责分离。
- `.ics` 导出是 MVP 的日历集成能力。
- 真实飞书日历同步是后续增强能力，除非用户明确重新调整优先级。

## 命令

当前没有已验证的项目命令。创建 `package.json` 和锁文件后，再根据真实脚本补充本节。

## Git 指南

- 保持小步提交，按阶段提交。
- 建议提交边界：
  - 文档和规格变更
  - 项目脚手架
  - 数据模型
  - 排程算法
  - AI 规划服务
  - 后端 API
  - 前端流程
  - 验证和交付文档

## 测试指南

开始实现后，优先覆盖：

- 每周可用时间校验
- 不均匀星期可用时间下的排程
- 任务跨多个日程块拆分
- 可用时间不足的处理
- AI 输出校验
- API 契约
- 日历导出

## 后续更新说明

脚手架创建后，请用真实脚本和配置更新本文件，不要写猜测命令。
