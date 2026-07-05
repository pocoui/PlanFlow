import { NextResponse } from "next/server";

import { PlanServiceError, updateTaskStatus } from "@/lib/services/planService";
import { getRepository } from "@/lib/server/repository";

interface RouteContext {
  params: Promise<{
    taskId: string;
  }>;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { taskId } = await context.params;
    const body = await request.json();
    const task = await updateTaskStatus(taskId, body.status, { repository: getRepository() });

    return NextResponse.json(task);
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
