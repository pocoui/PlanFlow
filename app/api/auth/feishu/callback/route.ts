import { NextResponse } from "next/server";

import {
  exchangeCodeForUserToken,
  serializeUserToken,
} from "@/lib/feishu-oauth";

/**
 * GET /api/auth/feishu/callback
 *
 * 飞书 OAuth2 授权回调，飞书会带上 code 和 state 参数。
 * 1. 用 code 换取 user_access_token（v2/oauth/token 接口）
 * 2. 将 token 存入 cookie（feishu_user_token）
 * 3. 重定向回仪表盘页面
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") ?? ""; // state 里存的是 planId
  const origin = new URL(request.url).origin;

  if (!code) {
    return NextResponse.json(
      { error: { code: "MISSING_CODE", message: "缺少授权码" } },
      { status: 400 }
    );
  }

  const appId = process.env.FEISHU_APP_ID;
  const appSecret = process.env.FEISHU_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.json(
      { error: { code: "CONFIG_ERROR", message: "未配置飞书应用凭证" } },
      { status: 500 }
    );
  }

  try {
    const redirectUri = `${origin}/api/auth/feishu/callback`;

    // 使用 v2/oauth/token 接口，用 client_id + client_secret 换取 user_access_token
    const userToken = await exchangeCodeForUserToken({
      code,
      appId,
      appSecret,
      redirectUri,
    });

    // 重定向回仪表盘页面（planId 作为查询参数），同时设置 cookie
    const redirectPath = state ? `/dashboard?planId=${encodeURIComponent(state)}` : "/dashboard";
    const redirectUrl = `${origin}${redirectPath}`;

    const response = NextResponse.redirect(redirectUrl);

    // 将 token 存入 cookie，有效期与 refresh_token 一致（30 天）
    // cookies.set 会自动编码，不需要手动 encodeURIComponent
    response.cookies.set("feishu_user_token", serializeUserToken(userToken), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 天
      path: "/",
    });

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "授权失败";
    // 授权失败，重定向回仪表盘页面并附带错误信息
    const redirectPath = state ? `/dashboard?planId=${encodeURIComponent(state)}` : "/dashboard";
    return NextResponse.redirect(
      `${origin}${redirectPath}&feishu_auth_error=${encodeURIComponent(message)}`
    );
  }
}
