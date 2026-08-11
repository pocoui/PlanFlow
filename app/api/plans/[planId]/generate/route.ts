import { NextResponse } from "next/server";

import { getRequiredUserId, unauthorizedResponse } from "@/lib/auth/session";
import { generatePlan, PlanServiceError } from "@/lib/services/planService";
import { getAiConfigFromEnv } from "@/lib/server/aiConfig";
import { getRepository } from "@/lib/server/repository";

interface RouteContext {
  params: Promise<{
    planId: string;
  }>;
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params;
    const userId = await getRequiredUserId();
    if (!userId) return unauthorizedResponse();

    // 优先从请求体读取 AI 配置（前端 localStorage），否则用环境变量兜底
    let aiConfig = getAiConfigFromEnv();
    try {
      const body = (await request.json()) as { aiConfig?: unknown };
      if (body.aiConfig && typeof body.aiConfig === "object") {
        aiConfig = body.aiConfig as typeof aiConfig;
      }
    } catch {
      // 请求体为空或不合法，使用环境变量兜底
    }

    const result = await generatePlan(planId, {
      repository: getRepository(),
      aiConfig,
      userId
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}

function toErrorResponse(error: unknown) {
  if (error instanceof PlanServiceError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? {}
        }
      },
      { status: error.code === "NOT_FOUND" ? 404 : 400 }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error.",
        details: {}
      }
    },
    { status: 500 }
  );
}
