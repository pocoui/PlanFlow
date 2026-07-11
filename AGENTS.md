# AGENTS.md

PlanFlow AI 当前是一个 Next.js App Router + TypeScript 全栈项目。第一阶段脚手架已创建，复杂业务尚未实现。

## 当前仓库状态

- Git 已初始化。
- 计划文档位于 `docs/`。
- 计划技术栈为 Next.js App Router + React + TypeScript、Route Handlers、Prisma + PostgreSQL、Tailwind CSS + shadcn/ui、Zod、Vitest 和 Playwright。
- 已创建 `package.json`、基础配置、`app/`、`components/`、`lib/`、`packages/`、`prisma/` 和 `test/`。
- Prisma schema、业务 API、AI 规划服务、排程算法和业务 UI 已实现。
- 部署目标：Vercel + Supabase (PostgreSQL)。

## 工作规则

- 不要编造仓库配置里不存在的命令。
- 开始实现前先阅读：
  - `docs/PRD.md`
  - `docs/TECH_DESIGN.md`
  - `docs/API_SPEC.md`
  - `docs/DATA_MODEL.md`
  - `docs/IMPLEMENTATION_PLAN.md`
  - `docs/TEST_PLAN.md`
- AI 规划、日历 provider、真实可用时间计算、排程算法、复盘顺延、日历导出、API 路由和 UI 组件要按职责分离。
- 飞书日历是核心集成目标，MVP 使用 `CalendarProvider` 和 `MockFeishuCalendarProvider` 模拟忙闲时间。
- `.ics` 导出是兜底能力，不是唯一日历集成路径。

## 命令

安装依赖：

```bash
npm install
```

启动开发服务：

```bash
npm run dev
```

质量检查：

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Git 指南

- 保持小步提交，按阶段提交。
- 使用中文提交信息。
-- 建议提交边界：
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
- 飞书忙闲时间冲突扣除
- 冲突后缓冲时间
- 任务跨多个日程块拆分
- 可用时间不足的处理
- 复盘后的剩余任务顺延
- AI 输出校验
- API 契约
- 日历导出

## 部署

目标：Vercel + Supabase (PostgreSQL)

### 环境变量

复制 `.env.example` 为 `.env`，填入实际值。必填项：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | Supabase PostgreSQL 连接串（使用 Connection Pooling 模式，端口 6543） |
| `FEISHU_APP_ID` | 飞书开放平台应用 ID |
| `FEISHU_APP_SECRET` | 飞书开放平台应用 Secret |
| `CALENDAR_PROVIDER` | `feishu` 或 `mock_feishu` |

可选项：`AI_PROVIDER`、`OPENAI_BASE_URL`、`OPENAI_MODEL`、`OPENAI_API_KEY`

### 部署步骤

1. 在 Supabase 创建项目，获取 `DATABASE_URL`
2. 本地执行 `npx prisma db push` 推送 schema 到远程数据库
3. 将 GitHub 仓库导入 Vercel
4. 在 Vercel 项目设置中配置环境变量
5. 飞书开放平台更新 OAuth 回调地址为 `https://<vercel-domain>/api/auth/feishu/callback`
6. 推送代码触发自动部署

### 注意事项

- `vercel.json` 已配置 `buildCommand` 包含 `npx prisma generate`
- 未配置 `DATABASE_URL` 时自动回退到内存存储（仅开发用，重启丢数据）
- Cookie 在 `NODE_ENV=production` 时自动启用 `secure` 标志

## 后续更新说明

脚手架创建后，请用真实脚本和配置更新本文件，不要写猜测命令。

# Learning Mode

本项目不仅用于开发，也用于学习 React、Node.js 和现代全栈开发。

请遵循以下规则：

- 编写符合生产环境质量、可读性高的代码，优先选择社区主流方案。
- 添加适量且有价值的注释，重点解释「为什么这样设计」，避免对显而易见的代码逐行注释。
- 第一次使用 React 概念时，简要对比 Vue3（如 useState ↔ ref、useEffect ↔ watch、Zustand ↔ Pinia）。
- 实现每个功能前，先说明实现思路、涉及文件和技术选型。
- 实现完成后，简要总结：
  - 本次实现了什么
  - 为什么这样设计
  - 涉及哪些 React/Node 知识点
  - 一个相关的前端面试考点及参考回答
- 如果存在多种实现方案，优先选择企业项目中最常用、最适合学习和面试的方案，并说明选择理由。
- 在保证代码质量的前提下，优先考虑帮助开发者理解 React/Node.js 技术栈，而不是追求复杂或炫技的实现。
