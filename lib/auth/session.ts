import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

/**
 * API 路由统一鉴权辅助。
 *
 * 中间件已对未登录业务 API 返回 401，此处为纵深防御，同时把 userId
 * 从会话线程化进 planService（计划按用户隔离）。
 */
export async function getRequiredUserId(): Promise<string | null> {
  const session = await auth();

  return session?.user?.id ?? null;
}

/** 未登录统一 401 响应 */
export function unauthorizedResponse(): NextResponse {
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
