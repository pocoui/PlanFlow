import { NextResponse } from "next/server";

import {
  syncSessionsToCalendar,
  PlanServiceError
} from "@/lib/services/planService";
import { getRepository } from "@/lib/server/repository";
import { createCalendarProvider, hasUserAccessToken } from "@/lib/calendar/createCalendarProvider";

interface RouteContext {
  params: Promise<{ planId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params;

    // 从 cookie 中读取飞书用户 token
    const cookieHeader = request.headers.get("cookie") ?? "";
    const userTokenCookie = parseCookieValue(cookieHeader, "feishu_user_token");

    // 未授权时返回授权 URL，前端据此跳转
    if (!hasUserAccessToken(userTokenCookie)) {
      const origin = new URL(request.url).origin;
      return NextResponse.json(
        {
          error: {
            code: "FEISHU_AUTH_REQUIRED",
            message: "请先授权飞书账号",
            details: {
              authorizeUrl: `${origin}/api/auth/feishu/authorize?planId=${encodeURIComponent(planId)}`,
            },
          },
        },
        { status: 401 }
      );
    }

    const result = await syncSessionsToCalendar(planId, {
      repository: getRepository(),
      calendarProvider: createCalendarProvider({ userTokenCookie })
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    if (error instanceof PlanServiceError) {
      return NextResponse.json(
        { error: { code: error.code, message: error.message, details: error.details ?? {} } },
        { status: statusForError(error) }
      );
    }

    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Unexpected server error.", details: {} } },
      { status: 500 }
    );
  }
}

function statusForError(error: PlanServiceError): number {
  if (error.code === "NOT_FOUND") return 404;
  if (error.code === "CONFLICT") return 409;
  return 400;
}

/** 从 cookie 字符串中解析指定 key 的值 */
function parseCookieValue(cookieHeader: string, key: string): string | undefined {
  const match = cookieHeader
    .split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${key}=`));
  return match?.slice(key.length + 1);
}
