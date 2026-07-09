import { NextResponse } from "next/server";

import { buildFeishuAuthorizeUrl } from "@/lib/feishu-oauth";

/**
 * GET /api/auth/feishu/authorize
 *
 * 用户点击"连接飞书"后，跳转到此接口，重定向到飞书 OAuth2 授权页。
 * 授权成功后飞书会回调 /api/auth/feishu/callback?code=xxx&state=xxx
 *
 * 查询参数：
 * - planId: 可选，授权后回到哪个计划页面
 */
export async function GET(request: Request) {
  const appId = process.env.FEISHU_APP_ID;
  if (!appId) {
    return NextResponse.json(
      { error: { code: "CONFIG_ERROR", message: "未配置 FEISHU_APP_ID" } },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const planId = searchParams.get("planId") ?? "";

  // 回调地址必须是飞书开放平台配置的重定向 URL 之一
  const redirectUri = `${new URL(request.url).origin}/api/auth/feishu/callback`;

  const authorizeUrl = buildFeishuAuthorizeUrl({
    appId,
    redirectUri,
    state: planId,
    // 用户授权权限：calendar:calendar 包含日历读写，offline_access 用于刷新 token
    scope: "calendar:calendar offline_access",
  });

  return NextResponse.redirect(authorizeUrl);
}
