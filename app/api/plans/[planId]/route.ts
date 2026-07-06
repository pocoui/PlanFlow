import { NextResponse } from "next/server";

import { deletePlan, getPlan, PlanServiceError } from "@/lib/services/planService";
import { getRepository } from "@/lib/server/repository";

interface RouteContext {
  params: Promise<{
    planId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params;
    const plan = await getPlan(planId, { repository: getRepository() });

    return NextResponse.json(plan);
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params;
    await deletePlan(planId, { repository: getRepository() });

    return NextResponse.json({ success: true });
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
