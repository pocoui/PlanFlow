# PlanFlow AI

PlanFlow AI 是一个 AI 学习计划与日历排程助手。用户输入学习目标，配置每周可学习时间，系统生成结构化学习任务，并把任务安排到真实可执行的日历时间段里。

## MVP 方向

第一版重点实现：

- 创建学习目标
- 按星期配置可用时间规则
- AI 风格的任务拆解
- 结合真实日历忙闲的排程算法
- 冲突后自定义缓冲时间
- 日历看板
- 学习结束后的复盘和顺延
- `.ics` 日历导出

飞书日历是核心集成目标。3 天 MVP 先通过 `CalendarProvider` 和 `MockFeishuCalendarProvider` 模拟忙闲时间，验证冲突感知、复盘顺延和日程生成闭环；真实飞书 API 作为同一接口下的增强接入。`.ics` 导出保留为兜底能力。

## 计划技术栈

- Next.js App Router + React + TypeScript
- Next.js Route Handlers
- Prisma + PostgreSQL
- Tailwind CSS + shadcn/ui
- Zod
- Vitest 和 Playwright

## 当前状态

项目已完成第一阶段的基础脚手架：

- Next.js App Router 项目结构
- Route Handlers 基础 API 目录
- `packages/shared` 和 `packages/scheduler` 工作区占位
- Tailwind CSS、TypeScript、ESLint、Vitest 和 Playwright 配置
- 环境变量示例

当前还没有实现 Prisma schema、业务 API、AI 规划、排程算法或前端业务流程。

## 本地启动

安装依赖：

```bash
npm install
```

复制环境变量示例：

```powershell
Copy-Item .env.example .env
```

启动开发服务：

```bash
npm run dev
```

默认访问：

- Web 页面：`http://localhost:3000`
- 健康检查：`http://localhost:3000/api/health`

## 常用命令

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 文档

- [PRD](docs/PRD.md)
- [技术设计](docs/TECH_DESIGN.md)
- [API 规格](docs/API_SPEC.md)
- [数据模型](docs/DATA_MODEL.md)
- [实施计划](docs/IMPLEMENTATION_PLAN.md)
- [测试计划](docs/TEST_PLAN.md)

## 面试定位

PlanFlow AI 不是普通 Todo 应用。它展示的是：如何把自然语言学习目标转成结构化任务，如何结合用户每周可用时间和真实日历忙闲做排程，如何用自定义缓冲时间避免任务紧贴会议，以及如何通过复盘把未完成任务顺延到后续可用时间。
