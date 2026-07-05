import { NextResponse } from "next/server";

import { createPlan, PlanServiceError } from "@/lib/services/planService";
import { getRepository } from "@/lib/server/repository";

export async function GET() {
  try {
    const repository = getRepository();
    const plans = await repository.listPlans();

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
    const plan = await createPlan(body, { repository: getRepository() });

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
