/**
 * 密码哈希工具：基于 node:crypto 的 scrypt 算法
 *
 * 哈希格式：`salt:hash`，salt 与 hash 均为 hex 字符串（盐随机，哈希定长）。
 * - hashPassword 使用随机盐生成哈希，同一密码每次结果不同
 * - verifyPassword 用 timingSafeEqual 做定长比对，避免时序侧信道攻击
 * - 零第三方依赖，仅使用 Node.js 内置模块
 */

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SALT_LENGTH = 16; // 盐字节数
const KEY_LENGTH = 64; // scrypt 派生密钥字节数

/**
 * 生成 scrypt 哈希，格式为 `salt:hash`（均 hex 编码）
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const derivedKey = scryptSync(password, salt, KEY_LENGTH);

  return `${salt.toString("hex")}:${derivedKey.toString("hex")}`;
}

/**
 * 校验密码与 `salt:hash` 格式的存储值是否匹配（timing-safe）
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");

  if (!saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const expected = Buffer.from(hashHex, "hex");

  // timingSafeEqual 要求两个 Buffer 定长，长度不匹配时直接判定失败
  if (expected.length === 0) {
    return false;
  }

  const actual = scryptSync(password, salt, expected.length);

  return timingSafeEqual(actual, expected);
}
