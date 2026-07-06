import { validateWeeklyAvailability } from "@planflow/shared";
import type { WeeklyAvailabilityRuleInput } from "@planflow/shared";
import { getAiConfig } from "./aiConfig";
import type { AiProviderConfig } from "./aiConfig";

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

export interface GeneratedTask {
  id: string;
  title: string;
  phase?: string;
  estimatedMinutes: number;
  priority?: number;
  status?: string;
  acceptanceCriteria?: string[];
}

export interface GeneratePlanResponse {
  planId: string;
  tasks: GeneratedTask[];
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

export interface GenerateTasksResponse {
  planId: string;
  tasks: GeneratedTask[];
  warnings: Array<{
    code: string;
    message: string;
    targetTotalMinutes?: number;
    generatedTotalMinutes?: number;
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

  // 分层引导 · 硬校验：配置无效时在创建计划前就报错，避免浪费一次 API 调用
  const aiConfig = getAiConfig();
  const configError = checkAiConfigValid(aiConfig);
  if (configError !== null) {
    throw new Error(configError);
  }

  const plan = await postJson<CreatedPlanResponse>(
    "/api/plans",
    payload,
    fetcher
  );
  const generation = await postJson<GeneratePlanResponse>(
    `/api/plans/${plan.id}/generate`,
    { aiConfig },
    fetcher
  );

  return { plan, generation };
}

export async function generatePlanTasks(
  planId: string,
  fetcher: PlanCreationFetcher = fetch
): Promise<GenerateTasksResponse> {
  const aiConfig = getAiConfig();
  const configError = checkAiConfigValid(aiConfig);
  if (configError !== null) {
    throw new Error(configError);
  }

  return postJson<GenerateTasksResponse>(
    `/api/plans/${planId}/tasks/generate`,
    { aiConfig },
    fetcher
  );
}

export async function schedulePlan(
  planId: string,
  fetcher: PlanCreationFetcher = fetch
): Promise<GeneratePlanResponse> {
  return postJson<GeneratePlanResponse>(
    `/api/plans/${planId}/schedule`,
    undefined,
    fetcher
  );
}

/** 从 localStorage 读取当前 AI 配置，供前端组件使用 */
export function getCurrentAiConfig(): AiProviderConfig {
  return getAiConfig();
}

/**
 * 检查 AI 配置是否可用于调用真实 API。
 * 返回 `null` 表示通过；否则返回人类可读的错误原因。
 * mock 模式始终通过；openai_compatible 需要 baseUrl / model / apiKey 三项均非空。
 */
export function checkAiConfigValid(config: AiProviderConfig): string | null {
  if (config.provider === "mock") return null;

  const missing: string[] = [];
  if (!config.openai.baseUrl.trim()) missing.push("Base URL");
  if (!config.openai.model.trim()) missing.push("Model");
  if (!config.openai.apiKey.trim()) missing.push("API Key");

  if (missing.length > 0) {
    return `AI 配置不完整，缺少：${missing.join("、")}。请前往设置页面配置。`;
  }

  return null;
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
