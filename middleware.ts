import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";
import { handleCsrf } from "@/lib/server/csrf";

// 用 edge-safe 配置自建轻量实例（无 providers），仅解码 JWT cookie 判断登录态；
// 若复用 lib/auth.ts 的完整实例会把 Credentials/userStore(node:crypto) 打进 edge bundle。
const { auth } = NextAuth(authConfig);

/** Auth.js 内部端点（自带 CSRF 与认证处理，直接放行给 [...nextauth]） */
const AUTH_JS_PATHS = new Set([
  "/api/auth/session",
  "/api/auth/csrf",
  "/api/auth/providers",
  "/api/auth/signin",
  "/api/auth/signout",
  "/api/auth/callback/credentials",
  "/api/auth/error",
]);

/** 公开页面（无需登录即可访问） */
const PUBLIC_PAGE_PATHS = new Set(["/login", "/register"]);

/**
 * 全站认证守卫 + CSRF 防护（Edge runtime）。
 *
 * 访问控制：
 * - 未登录访问受保护页面 → 307 重定向 /login?redirect=原路径
 * - 未登录访问业务 API → 401 JSON
 * - 公开：/login、/register、/api/health、/api/auth/register、Auth.js 内部端点
 * - CSRF：业务 /api/* 保持 double-submit 防护（/api/auth/register 保留防护）
 *
 * 顺序说明：业务 API 先做认证判定再做 CSRF，避免 handleCsrf 的「首次写 cookie 直通」
 * 短路掉 401 —— 未登录业务 API 一律先被认证拦截。
 *
 * Edge 兼容：auth 包装仅解码 JWT cookie；authorize 内的 Prisma 经动态 import 隔离，
 * middleware bundle 不含 Prisma（构建后验证 .next/server/middleware.js）。
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = Boolean(req.auth?.user);

  // 1) Auth.js 内部端点 & 飞书 OAuth 重定向入口：交回 [...nextauth] 处理（自带 CSRF）
  if (AUTH_JS_PATHS.has(pathname) || pathname.startsWith("/api/auth/feishu/")) {
    return NextResponse.next();
  }

  // 2) 公开页面
  if (PUBLIC_PAGE_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  // 3) 公开 API
  if (pathname === "/api/health") {
    return NextResponse.next();
  }
  if (pathname === "/api/auth/register") {
    // 公开注册：保留 CSRF 防护（前端 csrfFetch 携带 token）
    return handleCsrf(req) ?? NextResponse.next();
  }

  // 4) 业务 API：先认证后 CSRF
  if (pathname.startsWith("/api/")) {
    if (!isLoggedIn) {
      return NextResponse.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "请先登录后再访问",
            details: {},
          },
        },
        { status: 401 }
      );
    }
    return handleCsrf(req) ?? NextResponse.next();
  }

  // 5) 受保护页面：未登录重定向登录页（带回跳地址）
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * 覆盖所有页面与业务 API，排除 Next.js 静态资源：
     * - _next/static|_next/image：JS/CSS/图片 bundle
     * - favicon.ico
     * 注：/api/auth/* 不整体排除——/api/auth/register 需经本中间件保留 CSRF 防护，
     * Auth.js 内部端点由上方 AUTH_JS_PATHS 白名单直通。
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
