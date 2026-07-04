import { validateWeeklyAvailability } from "@planflow/shared";
import type { WeeklyAvailabilityRuleInput } from "@planflow/shared";

export interface PlanCreationFormState {
  title: string;
  goal: string;
  totalMinutes: string;
  startDate: string;
  deadline: string;
  rescheduleBufferMinutes: string;
  availability: WeeklyAvailabilityRuleInput[];
}

export interface CreatePlanPayload {
  title: string;
  goal: string;
  totalMinutes: number;
  startDate: string;
  deadline: string;
  rescheduleBufferMinutes: number;
  availability: WeeklyAvailabilityRuleInput[];
}

export interface CreatedPlanResponse {
  id: string;
  title: string;
  status?: string;
  createdAt?: string;
}

export interface GeneratePlanResponse {
  planId: string;
  tasks: Array<{
    id: string;
    title: string;
    phase?: string;
    estimatedMinutes: number;
    priority?: number;
    status?: string;
    acceptanceCriteria?: string[];
  }>;
  sessions: Array<{
    id: string;
    taskId: string;
    startAt: string;
    endAt: string;
    durationMinutes?: number;
    status: string;
  }>;
  busySlots: Array<{
    id: string;
    title: string;
    source?: string;
    startAt: string;
    endAt: string;
  }>;
  warnings: Array<{
    code: string;
    message: string;
    taskId?: string;
    remainingMinutes?: number;
  }>;
}

export interface PlanCreationResult {
  plan: CreatedPlanResponse;
  generation: GeneratePlanResponse;
}

export interface PlanCreationValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof PlanCreationFormState, string>>;
}

export type PlanCreationFetcher = (
  url: string,
  init?: RequestInit
) => Promise<Response>;

export function validatePlanCreationForm(
  form: PlanCreationFormState
): PlanCreationValidationResult {
  const errors: PlanCreationValidationResult["errors"] = {};
  const totalMinutes = Number(form.totalMinutes);
  const rescheduleBufferMinutes = Number(form.rescheduleBufferMinutes);
  const startDate = new Date(form.startDate);
  const deadline = new Date(form.deadline);
  const availabilityValidation = validateWeeklyAvailability(form.availability);

  if (form.title.trim().length === 0) {
    errors.title = "Plan title is required.";
  }

  if (form.goal.trim().length === 0) {
    errors.goal = "Learning goal is required.";
  }

  if (!Number.isInteger(totalMinutes) || totalMinutes <= 0) {
    errors.totalMinutes = "Total minutes must be greater than 0.";
  }

  if (Number.isNaN(startDate.getTime())) {
    errors.startDate = "Start date is required.";
  }

  if (Number.isNaN(deadline.getTime())) {
    errors.deadline = "Deadline is required.";
  } else if (!Number.isNaN(startDate.getTime()) && deadline <= startDate) {
    errors.deadline = "Deadline must be later than start date.";
  }

  if (
    !Number.isInteger(rescheduleBufferMinutes) ||
    rescheduleBufferMinutes < 0
  ) {
    errors.rescheduleBufferMinutes =
      "Buffer minutes must be greater than or equal to 0.";
  }

  if (!availabilityValidation.valid) {
    errors.availability = availabilityValidation.errors[0]?.message;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

export function buildCreatePlanPayload(
  form: PlanCreationFormState
): CreatePlanPayload {
  const validation = validatePlanCreationForm(form);

  if (!validation.valid) {
    throw new Error(Object.values(validation.errors)[0] ?? "Form is invalid.");
  }

  return {
    title: form.title.trim(),
    goal: form.goal.trim(),
    totalMinutes: Number(form.totalMinutes),
    startDate: form.startDate,
    deadline: form.deadline,
    rescheduleBufferMinutes: Number(form.rescheduleBufferMinutes),
    availability: form.availability.map((rule) => ({ ...rule }))
  };
}

export async function createAndGeneratePlan(
  form: PlanCreationFormState,
  fetcher: PlanCreationFetcher = fetch
): Promise<PlanCreationResult> {
  const payload = buildCreatePlanPayload(form);
  const plan = await postJson<CreatedPlanResponse>(
    "/api/plans",
    payload,
    fetcher
  );
  const generation = await postJson<GeneratePlanResponse>(
    `/api/plans/${plan.id}/generate`,
    undefined,
    fetcher
  );

  return { plan, generation };
}

async function postJson<T>(
  url: string,
  body: unknown,
  fetcher: PlanCreationFetcher
): Promise<T> {
  const response = await fetcher(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  return parseJsonResponse<T>(response);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = getErrorMessage(body) ?? "Request failed.";

    throw new Error(message);
  }

  return body as T;
}

function getErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("error" in body)) {
    return null;
  }

  const error = body.error;

  if (!error || typeof error !== "object" || !("message" in error)) {
    return null;
  }

  return typeof error.message === "string" ? error.message : null;
}
