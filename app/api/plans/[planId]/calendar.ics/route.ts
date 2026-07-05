import { NextResponse } from "next/server";

import {
  exportPlanCalendarIcs,
  PlanServiceError
} from "@/lib/services/planService";
import { getRepository } from "@/lib/server/repository";

interface RouteContext {
  params: Promise<{
    planId: string;
  }>;
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { planId } = await context.params;
    const calendar = await exportPlanCalendarIcs(planId, { repository: getRepository() });

    return new NextResponse(calendar, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${planId}.ics"`
      }
    });
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
