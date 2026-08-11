/**
 * 用户存储：双模式（in-memory / Prisma）
 *
 * - in-memory（DATABASE_URL 未设）：直接比对 env 的 ADMIN_EMAIL/ADMIN_PASSWORD，
 *   注册用户写入内存 Map（进程重启丢失，仅测试/CI 场景）
 * - Prisma（DATABASE_URL 已设）：查 User 表 passwordHash 校验，管理员凭据首次登录
 *   自动 upsert 种子管理员；注册用户按 email 落库持久化
 *
 * fail-closed：in-memory 模式下 ADMIN_EMAIL / ADMIN_PASSWORD 任一缺失时拒绝一切登录
 * 并输出明确日志，不静默放行。
 *
 * Prisma 分支以**动态 import** 隔离（仅认证/注册请求时在 Node 端加载），
 * in-memory 模式零 Prisma 查询、不构造 PrismaClient。
 * 数据库不可用（查询/upsert 失败）抛 UserStoreError("DATABASE_UNAVAILABLE")，
 * 返回可读错误，不裸抛堆栈。
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
    public readonly code:
      | "VALIDATION_ERROR"
      | "CONFLICT"
      | "DATABASE_UNAVAILABLE",
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
 * - Prisma 模式：查 User.passwordHash 校验；种子管理员凭据首次登录自动 upsert
 * - in-memory 模式：fail-closed（env 凭据缺失拒绝一切登录），先查内存注册用户再比对 env 管理员
 *
 * 数据库不可用时抛 UserStoreError("DATABASE_UNAVAILABLE")，由调用方转可读错误。
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<VerifiedUser | null> {
  if (process.env.DATABASE_URL) {
    return verifyCredentialsPrisma(email, password);
  }
  return verifyCredentialsInMemory(email, password);
}

/**
 * Prisma 模式凭据校验。
 * - findUnique 查用户；库中无且凭据匹配种子管理员 → 自动 upsert 种子 User（passwordHash 存库）
 * - 查出的用户用 scrypt 校验 passwordHash
 * - DB 不可用抛 DATABASE_UNAVAILABLE，不裸抛堆栈
 */
async function verifyCredentialsPrisma(
  email: string,
  password: string
): Promise<VerifiedUser | null> {
  const { prisma } = await import("@/lib/db/prisma");

  const normalizedEmail = normalizeEmail(email);
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  let user;
  try {
    user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  } catch (e) {
    console.error("[userStore] 数据库不可用（查询用户失败）:", e);
    throw new UserStoreError("DATABASE_UNAVAILABLE", "认证服务暂时不可用，请稍后重试");
  }

  // 库中无该用户且凭据匹配种子管理员 → 首次登录自动种子
  if (
    !user &&
    adminEmail &&
    adminPassword &&
    normalizedEmail === normalizeEmail(adminEmail) &&
    password === adminPassword
  ) {
    try {
      user = await prisma.user.upsert({
        where: { email: normalizedEmail },
        update: {},
        create: {
          email: normalizedEmail,
          name: "Admin",
          passwordHash: hashPassword(adminPassword),
        },
      });
    } catch (e) {
      console.error("[userStore] 数据库不可用（种子管理员 upsert 失败）:", e);
      throw new UserStoreError("DATABASE_UNAVAILABLE", "认证服务暂时不可用，请稍后重试");
    }
  }

  if (!user?.passwordHash) {
    return null;
  }

  if (!verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? "",
  };
}

/**
 * in-memory 模式凭据校验。
 * 1. fail-closed：ADMIN_EMAIL/ADMIN_PASSWORD 任一缺失 → 拒绝一切登录并输出日志
 * 2. 先查内存注册用户（比对 passwordHash），再比对 env 管理员凭据
 */
async function verifyCredentialsInMemory(
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
 * 注册用户。校验：邮箱格式、密码 ≥8 位、重复邮箱拒绝（CONFLICT）。
 * - Prisma 模式：按 email 落库持久化，passwordHash 为 scrypt 哈希
 * - in-memory 模式：写入内存 Map（进程重启丢失）
 */
export async function registerUser(input: {
  email: string;
  password: string;
}): Promise<UserRecord> {
  if (process.env.DATABASE_URL) {
    return registerUserPrisma(input);
  }
  return registerUserInMemory(input);
}

/**
 * Prisma 模式注册：create User 落库。重复邮箱（P2002）→ CONFLICT；
 * DB 不可用 → DATABASE_UNAVAILABLE。
 */
async function registerUserPrisma(input: {
  email: string;
  password: string;
}): Promise<UserRecord> {
  const { prisma } = await import("@/lib/db/prisma");

  const email = normalizeEmail(input.email);

  if (!EMAIL_REGEX.test(email)) {
    throw new UserStoreError("VALIDATION_ERROR", "邮箱格式不正确");
  }

  if (input.password.length < 8) {
    throw new UserStoreError("VALIDATION_ERROR", "密码长度至少 8 位");
  }

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: email.split("@")[0],
        passwordHash: hashPassword(input.password),
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? "",
      passwordHash: user.passwordHash ?? null,
      createdAt: user.createdAt
    };
  } catch (e) {
    // P2002: unique constraint（重复邮箱）；鸭子类型判断避免顶层 import Prisma
    if ((e as { code?: string })?.code === "P2002") {
      throw new UserStoreError("CONFLICT", "该邮箱已注册");
    }
    console.error("[userStore] 数据库不可用（注册写入失败）:", e);
    throw new UserStoreError("DATABASE_UNAVAILABLE", "注册服务暂时不可用，请稍后重试");
  }
}

/**
 * in-memory 模式注册：写入内存 Map。
 */
async function registerUserInMemory(input: {
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
