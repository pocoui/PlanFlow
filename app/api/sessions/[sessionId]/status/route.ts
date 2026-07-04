import { NextResponse } from "next/server";

import {
  PlanServiceError,
  updateSessionStatus
} from "@/lib/services/planService";

interface RouteContext {
  params: Promise<{
    sessionId: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const body = await request.json();
    const session = await updateSessionStatus(sessionId, body.status);

    return NextResponse.json(session);
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
