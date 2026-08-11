# PlanFlow AI 认证说明

本文件说明 PlanFlow 的登录/注册机制、环境变量、双模式行为，以及旧数据隔离规则。

## 登录流程

- **技术栈**：Auth.js（next-auth v5，App Router）+ Credentials Provider + JWT 会话（无 Prisma adapter，7 天有效期）
- **公开注册**：`/register` 自助注册，email + 密码（≥8 字符），密码经 `node:crypto` scrypt 加盐哈希后存储
- **登录**：`/login`，成功后跳回 `?redirect=` 原页面（仅允许站内相对路径，防开放重定向）
- **全站保护**：未登录访问受保护页面 → 307 重定向 `/login?redirect=原路径`；未登录访问业务 API → 401 JSON
- **会话结构**：JWT 的 `sub` 持久化用户 id，`session.user.id` 在服务端/中间件一致可用

## 环境变量

| 变量 | 说明 |
|------|------|
| `AUTH_SECRET` | 会话签名密钥（JWT 加密）。生产必须设置为强随机值（`openssl rand -base64 32`），可复用原有 `JWT_SECRET` 的值 |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | 种子管理员凭据。Prisma 模式下首次用该凭据登录成功时自动 upsert 种子管理员 |
| `AUTH_TRUST_HOST` | 生产（非 localhost）部署必须 `true`，放行 Auth.js v5 的 `UntrustedHost` 防护 |
| `DATABASE_URL` | 控制用户存储模式：已设置 → Prisma `User` 表；为空 → 内存模式（直接比对管理员凭据） |

## 用户存储双模式

对齐 `lib/server/repository.ts` 的 Prisma/in-memory 哲学：

- **Prisma 模式**（`DATABASE_URL` 已设置）：查 `User` 表，首次用管理员凭据登录自动 upsert 种子管理员（scrypt 哈希）。注册的用户写入 `User` 表。
- **内存模式**（无 `DATABASE_URL`，CI/测试/演示）：直接对比 `.env` 管理员凭据，登录用户 id 固定为 `admin`（非 `mock-user`）。注册用户仅保存在进程内 Map（重启即失，且 dev 模式热重载下会话状态不稳定，**仅建议用于冒烟验证**）。

> 生产与本地联调请配置 `DATABASE_URL`（Prisma 模式），会话与注册数据持久可靠。

## 计划归属与旧数据隔离

自 v0.1 起，`planService` 从会话注入 `userId`，计划按用户隔离：

- 新建计划归属**当前登录用户**（不再是硬编码 `mock-user`）
- 越权访问他人计划统一返回 `NOT_FOUND`（不泄露存在性）
- `GET /api/plans` 仅返回当前用户自己的计划

**旧 `mock-user` 计划**：Prisma 模式下，历史上归属 `mock-user` 的计划在管理员登录后**不可见**（属预期隔离）。如需保留旧计划，可手动将 `LearningPlan.userId` 更新为管理员用户 id：

```sql
UPDATE "LearningPlan" SET "userId" = (SELECT id FROM "User" WHERE email = 'admin@planflow.ai' LIMIT 1) WHERE "userId" = 'mock-user';
```

## 安全要点

- **Edge 兼容**：`lib/auth.config.ts` 不含 Credentials provider；`authorize` 内动态 import `userStore`（Prisma/node:crypto 仅随授权请求在 Node 端加载），避免打进 middleware（Edge runtime 不支持 `node:crypto`）
- **CSRF**：业务 `/api/*` 保持 double-submit 防护；`/api/auth/*` 由 Auth.js 自管；`/api/auth/register` 保留 CSRF
- **密码**：scrypt 加盐哈希（`salt:hash` hex 格式），不落明文；登录错误统一文案防枚举
- **Fail-closed**：`AUTH_SECRET` 缺失时 Auth.js 启动即报错，不静默回退读取 `JWT_SECRET`
