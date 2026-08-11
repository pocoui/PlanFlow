import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerUser,
  resetRegisteredUsers,
  UserStoreError,
  verifyCredentials
} from "../userStore";

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
