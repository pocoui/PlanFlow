import { NextResponse } from "next/server";

import { getRequiredUserId, unauthorizedResponse } from "@/lib/auth/session";
import { schedulePlan, PlanServiceError } from "@/lib/services/planService";
import { getRepository } from "@/lib/server/repository";

interface RouteContext {
  params: Promise<{
    planId: string;
  }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params;
    const userId = await getRequiredUserId();
    if (!userId) return unauthorizedResponse();

    const result = await schedulePlan(planId, { repository: getRepository(), userId });

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
      { status: error.code === "NOT_FOUND" ? 404 : 409 }
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
