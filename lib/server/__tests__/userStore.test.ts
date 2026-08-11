import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hashPassword } from "../password";
import {
  registerUser,
  resetRegisteredUsers,
  UserStoreError,
  verifyCredentials
} from "../userStore";

/** Prisma 分支 mock client（vi.mock 工厂只能引用 mock* 前缀变量） */
const mockPrismaUser = {
  findUnique: vi.fn(),
  upsert: vi.fn(),
  create: vi.fn()
};

// 拦截 userStore 的动态 import("@/lib/db/prisma")，避免构造真实 PrismaClient
vi.mock("@/lib/db/prisma", () => ({
  prisma: { user: mockPrismaUser }
}));

const ADMIN_EMAIL = "admin@planflow.ai";
const ADMIN_PASSWORD = "planflow2024";

describe("userStore (in-memory)", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
  });

  afterEach(() => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    vi.restoreAllMocks();
  });

  it("verifies the env admin credentials", async () => {
    const user = await verifyCredentials(ADMIN_EMAIL, ADMIN_PASSWORD);

    expect(user).not.toBeNull();
    expect(user?.email).toBe(ADMIN_EMAIL);
    expect(user?.id).toBe("admin");
  });

  it("rejects a wrong admin password", async () => {
    const user = await verifyCredentials(ADMIN_EMAIL, "wrong-password");

    expect(user).toBeNull();
  });

  it("rejects an unknown email", async () => {
    const user = await verifyCredentials("nobody@planflow.ai", ADMIN_PASSWORD);

    expect(user).toBeNull();
  });

  it("registers a user and finds them in memory", async () => {
    resetRegisteredUsers();
    const registered = await registerUser({
      email: "user@example.com",
      password: "password123"
    });

    expect(registered.email).toBe("user@example.com");
    expect(registered.passwordHash).not.toContain("password123");

    const found = await verifyCredentials("user@example.com", "password123");
    expect(found?.id).toBe(registered.id);
    expect(found?.email).toBe("user@example.com");
  });

  it("rejects a duplicate email on register", async () => {
    resetRegisteredUsers();
    await registerUser({ email: "dup@example.com", password: "password123" });

    await expect(
      registerUser({ email: "dup@example.com", password: "another-password" })
    ).rejects.toBeInstanceOf(UserStoreError);
    await expect(
      registerUser({ email: "dup@example.com", password: "another-password" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("rejects a password shorter than 8 characters", async () => {
    await expect(
      registerUser({ email: "short@example.com", password: "short" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects an invalid email format", async () => {
    await expect(
      registerUser({ email: "not-an-email", password: "password123" })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects all logins and logs when admin env credentials are missing (fail-closed)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;

    const admin = await verifyCredentials(ADMIN_EMAIL, ADMIN_PASSWORD);
    expect(admin).toBeNull();

    const registered = await registerUser({
      email: "fail-closed@example.com",
      password: "password123"
    });
    const asRegistered = await verifyCredentials(
      "fail-closed@example.com",
      "password123"
    );
    expect(asRegistered).toBeNull();
    expect(registered.id).toBeTruthy();

    expect(errorSpy).toHaveBeenCalledWith(
      "[userStore] fail-closed: ADMIN_EMAIL/ADMIN_PASSWORD 未配置，拒绝一切登录"
    );
  });
});

describe("userStore (Prisma, DATABASE_URL 已设)", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://test";
    process.env.ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.DATABASE_URL;
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    vi.restoreAllMocks();
  });

  it("首次用管理员凭据登录时自动 upsert 种子管理员", async () => {
    // 库中无该用户，凭据匹配种子管理员 → upsert 落库
    mockPrismaUser.findUnique.mockResolvedValueOnce(null);
    mockPrismaUser.upsert.mockImplementationOnce(async ({ create }) => ({
      id: "u_admin",
      email: create.email,
      name: create.name,
      passwordHash: create.passwordHash
    }));

    const user = await verifyCredentials(ADMIN_EMAIL, ADMIN_PASSWORD);

    expect(user).toMatchObject({ id: "u_admin", email: ADMIN_EMAIL });
    expect(mockPrismaUser.upsert).toHaveBeenCalledTimes(1);
  });

  it("校验库中已有用户的 scrypt 密码哈希", async () => {
    mockPrismaUser.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: ADMIN_EMAIL,
      name: "Admin",
      passwordHash: hashPassword(ADMIN_PASSWORD)
    });

    const user = await verifyCredentials(ADMIN_EMAIL, ADMIN_PASSWORD);

    expect(user).toMatchObject({ id: "u1", email: ADMIN_EMAIL });
    expect(mockPrismaUser.findUnique).toHaveBeenCalledTimes(1);
  });

  it("密码错误时返回 null（不泄露校验细节）", async () => {
    mockPrismaUser.findUnique.mockResolvedValueOnce({
      id: "u1",
      email: ADMIN_EMAIL,
      name: "Admin",
      passwordHash: hashPassword(ADMIN_PASSWORD)
    });

    const user = await verifyCredentials(ADMIN_EMAIL, "wrong-password");

    expect(user).toBeNull();
  });

  it("数据库不可用时抛 DATABASE_UNAVAILABLE（不裸抛堆栈）", async () => {
    mockPrismaUser.findUnique.mockRejectedValueOnce(new Error("connection refused"));

    await expect(verifyCredentials(ADMIN_EMAIL, ADMIN_PASSWORD)).rejects.toMatchObject({
      code: "DATABASE_UNAVAILABLE"
    });
  });

  it("注册用户落库，重复邮箱（P2002）返回 CONFLICT", async () => {
    mockPrismaUser.create.mockImplementationOnce(async ({ data }) => ({
      id: "u_reg",
      email: data.email,
      name: data.name,
      passwordHash: data.passwordHash,
      createdAt: new Date()
    }));
    mockPrismaUser.create.mockRejectedValueOnce({ code: "P2002" });

    const registered = await registerUser({
      email: "new@example.com",
      password: "password123"
    });
    expect(registered.id).toBe("u_reg");
    expect(registered.passwordHash).not.toContain("password123");

    await expect(
      registerUser({ email: "new@example.com", password: "password123" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});
