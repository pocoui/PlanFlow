/**
 * CSRF 防护：Double-Submit Cookie 模式
 *
 * 原理：
 * - Middleware 在首次请求时生成随机 CSRF token，写入 HttpOnly=false 的 cookie
 * - 前端从 cookie 读取 token，在 mutating 请求（POST/PATCH/DELETE/PUT）中通过
 *   X-CSRF-Token header 回传
 * - Middleware 校验 header 与 cookie 中的 token 是否一致
 *
 * 设计决策：
 * - 使用 crypto.getRandomValues 生成 token，比 Math.random 更安全
 * - cookie 不设 HttpOnly，因为前端 JS 需要读取
 * - SameSite=Lax 提供 baseline 防护，double-submit 作为增强
 */

import { NextRequest, NextResponse } from "next/server";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** CSRF 保护路径前缀（仅保护 API 路由） */
const PROTECTED_PATH_PREFIX = "/api/";

/** 不需要 CSRF 校验的路径（OAuth 回调等外部重定向入口） */
const CSRF_EXCLUDED_PATHS = new Set([
  "/api/auth/feishu/callback",
  "/api/auth/feishu/authorize",
  "/api/health",
]);

/**
 * 生成 CSRF token（32 字节 = 64 hex 字符）
 */
function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * 从 cookie 字符串中解析指定 key 的值
 */
function getCookieValue(cookieHeader: string, key: string): string | undefined {
  const prefix = `${key}=`;
  const match = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

/**
 * 在 Next.js middleware 中处理 CSRF
 *
 * - 对所有请求：确保 csrf_token cookie 存在，不存在则生成并设置
 * - 对 mutating 请求（POST/PUT/PATCH/DELETE）：校验 header 与 cookie 中的 token 一致
 */
export function handleCsrf(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;

  // 仅保护 API 路径
  if (!pathname.startsWith(PROTECTED_PATH_PREFIX)) {
    return null;
  }

  // 排除不需要 CSRF 的路径
  if (CSRF_EXCLUDED_PATHS.has(pathname)) {
    return null;
  }

  const cookieToken = getCookieValue(request.headers.get("cookie") ?? "", CSRF_COOKIE_NAME);

  // 若 cookie 中无 token，生成并写入
  if (!cookieToken) {
    const token = generateCsrfToken();
    const response = NextResponse.next();
    response.cookies.set(CSRF_COOKIE_NAME, token, {
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
    return response;
  }

  // 非 mutating 请求无需校验
  if (!MUTATING_METHODS.has(request.method)) {
    return null;
  }

  // Mutating 请求：校验 header 与 cookie 一致
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!headerToken || headerToken !== cookieToken) {
    return NextResponse.json(
      {
        error: {
          code: "CSRF_TOKEN_MISMATCH",
          message: "CSRF token 校验失败，请刷新页面后重试。",
          details: {},
        },
      },
      { status: 403 }
    );
  }

  return null;
}

/**
 * 供前端使用：从 document.cookie 读取 CSRF token
 */
export function getCsrfTokenFromCookie(): string | undefined {
  return getCookieValue(document.cookie, CSRF_COOKIE_NAME);
}

export { CSRF_COOKIE_NAME, CSRF_HEADER_NAME };
