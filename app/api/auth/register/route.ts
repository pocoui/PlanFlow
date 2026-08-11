import { NextResponse } from "next/server";

import {
  registerRequestSchema,
  validateRequestBody
} from "@/lib/server/apiSchemas";
import { registerUser, UserStoreError } from "@/lib/server/userStore";

/**
 * POST /api/auth/register — 公开注册。
 *
 * 静态路由段，Next.js 静态段优先于 /api/auth/[...nextauth]，与 Auth.js 端点共存。
 * 保持现有 CSRF 防护（未加入 lib/server/csrf.ts 豁免名单），请求经 csrfFetch 携带 token。
 * 注册成功返回 201（不含 passwordHash），自动登录由前端以同样凭据调用 signIn 完成。
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "请求体必须是合法 JSON",
          details: {}
        }
      },
      { status: 400 }
    );
  }

  const validated = validateRequestBody(registerRequestSchema, body);
  if (!validated.success) {
    return validated.error;
  }

  try {
    const user = await registerUser({
      email: validated.data.email,
      password: validated.data.password
    });

    return NextResponse.json(
      {
        id: user.id,
        email: user.email,
        name: user.name
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof UserStoreError) {
      const status =
        error.code === "CONFLICT"
          ? 409
          : error.code === "DATABASE_UNAVAILABLE"
            ? 503
            : 400;
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            details: {}
          }
        },
        { status }
      );
    }

    console.error("[register] Unexpected error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "注册服务暂时不可用，请稍后重试",
          details: {}
        }
      },
      { status: 500 }
    );
  }
}
