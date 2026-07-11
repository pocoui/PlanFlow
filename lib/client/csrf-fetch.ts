/**
 * 带有 CSRF token 的 fetch 封装
 *
 * 使用方式：在 mutating 请求（POST/PATCH/PUT/DELETE）中使用 csrfFetch 代替原生 fetch，
 * 自动从 cookie 读取 CSRF token 并附加到 X-CSRF-Token header。
 *
 * 与 lib/server/csrf.ts 中的 Double-Submit Cookie 方案配合：
 * - Middleware 在首次请求时生成 CSRF token 写入 cookie
 * - 前端从此 cookie 读取 token，在 mutating 请求中通过 header 回传
 * - Middleware 校验 header 与 cookie 中的 token 一致
 */

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * 从 document.cookie 中读取指定 cookie 的值
 */
function readCookie(name: string): string | undefined {
  const prefix = `${name}=`;
  const match = document.cookie
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

/**
 * 增强版 fetch：自动附加 CSRF token header
 *
 * 仅对 mutating HTTP 方法（POST/PUT/PATCH/DELETE）自动附加 token。
 * GET/HEAD/OPTIONS 请求不附加。
 */
export async function csrfFetch(
  url: string | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method ?? "GET").toUpperCase();
  const mutatingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

  if (!mutatingMethods.has(method)) {
    return fetch(url, init);
  }

  const csrfToken = readCookie(CSRF_COOKIE_NAME);

  const headers = new Headers(init?.headers);
  if (csrfToken) {
    headers.set(CSRF_HEADER_NAME, csrfToken);
  }

  return fetch(url, { ...init, headers });
}
