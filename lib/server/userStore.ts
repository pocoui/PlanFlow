/**
 * 用户存储：in-memory 模式
 *
 * 双模式设计（Prisma 分支在 Step 3 补齐）：
 * - in-memory（DATABASE_URL 未设）：直接比对 env 的 ADMIN_EMAIL/ADMIN_PASSWORD，
 *   注册用户写入内存 Map（进程重启丢失，仅测试/CI 场景）
 * - 本文件不 import Prisma，DATABASE_URL 未设时零 Prisma 查询、不构造 PrismaClient
 *
 * fail-closed：ADMIN_EMAIL / ADMIN_PASSWORD 任一缺失时拒绝一切登录并输出明确日志，
 * 不静默放行。
 */

import { randomUUID } from "node:crypto";

import { hashPassword, verifyPassword } from "./password";

/** 已验证用户（供 authorize 会话持久化） */
export interface VerifiedUser {
  id: string;
  email: string;
  name: string;
}

/** 内存中的用户记录 */
export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string | null;
  createdAt: Date;
}

/** 用户存储业务错误 */
export class UserStoreError extends Error {
  constructor(
    public readonly code: "VALIDATION_ERROR" | "CONFLICT",
    message: string
  ) {
    super(message);
  }
}

/** 内存注册用户存储（key 为规范化 email） */
const registeredUsers = new Map<string, UserRecord>();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 规范化邮箱：去首尾空白 + 小写 */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * 校验邮箱+密码凭据，通过返回用户对象，失败返回 null。
 *
 * in-memory 模式：
 * 1. fail-closed：ADMIN_EMAIL/ADMIN_PASSWORD 任一缺失 → 拒绝一切登录并输出日志
 * 2. 先查内存注册用户（比对 passwordHash），再比对 env 管理员凭据
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<VerifiedUser | null> {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  // fail-closed：管理员凭据缺失时拒绝一切登录，不静默放行
  if (!adminEmail || !adminPassword) {
    console.error(
      "[userStore] fail-closed: ADMIN_EMAIL/ADMIN_PASSWORD 未配置，拒绝一切登录"
    );
    return null;
  }

  const normalizedEmail = normalizeEmail(email);

  // 1. 内存注册用户（passwordHash 比对）
  const registered = registeredUsers.get(normalizedEmail);
  if (registered?.passwordHash && verifyPassword(password, registered.passwordHash)) {
    return {
      id: registered.id,
      email: registered.email,
      name: registered.name
    };
  }

  // 2. env 管理员凭据比对
  if (
    normalizedEmail === normalizeEmail(adminEmail) &&
    password === adminPassword
  ) {
    return {
      id: "admin",
      email: normalizeEmail(adminEmail),
      name: "Admin"
    };
  }

  return null;
}

/**
 * 注册用户（in-memory 模式写入内存 Map）。
 * 校验：邮箱格式、密码 ≥8 位、重复邮箱拒绝（CONFLICT）。
 */
export async function registerUser(input: {
  email: string;
  password: string;
}): Promise<UserRecord> {
  const email = normalizeEmail(input.email);

  if (!EMAIL_REGEX.test(email)) {
    throw new UserStoreError("VALIDATION_ERROR", "邮箱格式不正确");
  }

  if (input.password.length < 8) {
    throw new UserStoreError("VALIDATION_ERROR", "密码长度至少 8 位");
  }

  if (registeredUsers.has(email)) {
    throw new UserStoreError("CONFLICT", "该邮箱已注册");
  }

  const user: UserRecord = {
    id: randomUUID(),
    email,
    name: email.split("@")[0],
    passwordHash: hashPassword(input.password),
    createdAt: new Date()
  };

  registeredUsers.set(email, user);

  return user;
}

/**
 * 清空内存注册用户（in-memory 模式重置，主要用于测试隔离）。
 */
export function resetRegisteredUsers(): void {
  registeredUsers.clear();
}
