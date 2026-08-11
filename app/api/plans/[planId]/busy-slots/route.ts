import { NextResponse } from "next/server";

import { getRequiredUserId, unauthorizedResponse } from "@/lib/auth/session";
import {
  getBusySlotsForPlan,
  PlanServiceError
} from "@/lib/services/planService";
import { getRepository } from "@/lib/server/repository";

interface RouteContext {
  params: Promise<{
    planId: string;
  }>;
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params;
    const userId = await getRequiredUserId();
    if (!userId) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const result = await getBusySlotsForPlan(planId, {
      start: searchParams.get("start") ?? "",
      end: searchParams.get("end") ?? ""
    }, { repository: getRepository(), userId });

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
      { status: statusForError(error) }
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

function statusForError(error: PlanServiceError): number {
  if (error.code === "NOT_FOUND") {
    return 404;
  }

  if (error.code === "CONFLICT") {
    return 409;
  }

  return 400;
}
