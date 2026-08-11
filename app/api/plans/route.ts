import { NextResponse } from "next/server";

import { getRequiredUserId, unauthorizedResponse } from "@/lib/auth/session";
import { createPlan, PlanServiceError } from "@/lib/services/planService";
import { getRepository } from "@/lib/server/repository";

export async function GET() {
  try {
    const userId = await getRequiredUserId();
    if (!userId) return unauthorizedResponse();

    const repository = getRepository();
    const plans = await repository.listPlans(userId);

    return NextResponse.json(
      plans.map((plan) => ({
        id: plan.id,
        title: plan.title,
        goal: plan.goal,
        status: plan.status,
        createdAt: plan.createdAt
      }))
    );
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const userId = await getRequiredUserId();
    if (!userId) return unauthorizedResponse();

    const plan = await createPlan(body, { repository: getRepository(), userId });

    return NextResponse.json(
      {
        id: plan.id,
        title: plan.title,
        status: plan.status,
        createdAt: plan.createdAt
      },
      { status: 201 }
    );
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

  // Prisma 连接错误（P1xxx）返回 503 而非 500，附带可读信息便于排查
  const prismaCode = (error as { code?: string })?.code;
  if (typeof prismaCode === "string" && prismaCode.startsWith("P1")) {
    console.error("[plans] Prisma connection error:", prismaCode, (error as Error).message);
    return NextResponse.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: "Database connection failed. Please try again later.",
          details: { prismaCode }
        }
      },
      { status: 503 }
    );
  }

  console.error("[plans] Unexpected error:", error);
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
