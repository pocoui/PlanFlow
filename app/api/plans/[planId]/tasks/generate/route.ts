import { NextResponse } from "next/server";

import { getRequiredUserId, unauthorizedResponse } from "@/lib/auth/session";
import { generatePlanTasks, PlanServiceError } from "@/lib/services/planService";
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

    console.log("[tasks/generate] 收到请求 planId:", planId);

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
    console.log("[tasks/generate] AI 配置 provider:", aiConfig.provider, "openai.baseUrl:", aiConfig.openai.baseUrl || "(empty)", "model:", aiConfig.openai.model || "(empty)", "apiKey:", aiConfig.openai.apiKey ? "***" : "(empty)");

    const result = await generatePlanTasks(planId, {
      repository: getRepository(),
      aiConfig,
      userId
    });

    console.log("[tasks/generate] 成功，生成 tasks:", result.tasks.length, "warnings:", result.warnings.length);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[tasks/generate] 失败:", error);
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

  // Prisma 连接错误（P1xxx）返回 503
  if (error instanceof Error && /^P1\d{3}$/.test(error.name)) {
    return NextResponse.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "数据库连接异常，请稍后重试。",
          details: { prismaCode: error.name }
        }
      },
      { status: 503 }
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message,
        details: {}
      }
    },
    { status: 500 }
  );
}
