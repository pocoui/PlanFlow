import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "../password";

describe("password", () => {
  it("hash-verify roundtrip for a correct password", () => {
    const stored = hashPassword("planflow2024");

    expect(verifyPassword("planflow2024", stored)).toBe(true);
  });

  it("rejects a wrong password", () => {
    const stored = hashPassword("planflow2024");

    expect(verifyPassword("wrong-password", stored)).toBe(false);
  });

  it("uses a random salt per hash", () => {
    const first = hashPassword("planflow2024");
    const second = hashPassword("planflow2024");

    expect(first).not.toBe(second);
    expect(first.split(":")[0]).not.toBe(second.split(":")[0]);
  });

  it("stores salt and hash in hex format", () => {
    const stored = hashPassword("planflow2024");
    const [salt, hash] = stored.split(":");

    expect(salt).toMatch(/^[0-9a-f]+$/);
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash).toHaveLength(128); // 64 字节 = 128 hex 字符
  });

  it("fails safely on malformed stored values without throwing", () => {
    expect(verifyPassword("planflow2024", "not-a-valid-hash")).toBe(false);
    expect(verifyPassword("planflow2024", "")).toBe(false);
    expect(verifyPassword("planflow2024", "aabb:ccdd")).toBe(false);
  });
});
