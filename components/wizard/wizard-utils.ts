import type { WeeklyAvailabilityRuleInput } from "@planflow/shared";
import { validateWeeklyAvailability } from "@planflow/shared";

import { csrfFetch } from "@/lib/client/csrf-fetch";

import type { DailyAvailability, PlanInfo } from "./wizard-types";
import { DEFAULT_BUFFER_MINUTES } from "./wizard-types";

// 使用 toISOString 确保 SSR/客户端产出相同的 UTC 日期，避免水合不一致导致 input 清空
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function utcDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function localDateStr(daysOffset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const initialPlanInfo: PlanInfo = {
  goal: "",
  totalHours: "60",
  startDate: utcToday(),
  deadline: utcDaysFromNow(7)
};

export const initialAvailability: DailyAvailability[] = [
  { weekday: 1, label: "周一", enabled: true, ranges: [{ startTime: "20:00", endTime: "22:00" }] },
  { weekday: 2, label: "周二", enabled: true, ranges: [{ startTime: "09:00", endTime: "12:00" }, { startTime: "20:00", endTime: "22:00" }] },
  { weekday: 3, label: "周三", enabled: true, ranges: [{ startTime: "20:00", endTime: "22:00" }] },
  { weekday: 4, label: "周四", enabled: true, ranges: [{ startTime: "20:00", endTime: "22:00" }] },
  { weekday: 5, label: "周五", enabled: true, ranges: [{ startTime: "09:00", endTime: "11:00" }, { startTime: "20:00", endTime: "22:00" }] },
  { weekday: 6, label: "周六", enabled: false, ranges: [] },
  { weekday: 0, label: "周日", enabled: false, ranges: [] }
];

export function validatePlanInfo(planInfo: PlanInfo) {
  const errors: Partial<Record<keyof PlanInfo, string>> = {};
  const totalHours = Number(planInfo.totalHours);
  const startDate = new Date(planInfo.startDate);
  const deadline = new Date(planInfo.deadline);

  if (planInfo.goal.trim().length === 0) {
    errors.goal = "请输入学习目标";
  }

  if (!Number.isFinite(totalHours) || totalHours <= 0) {
    errors.totalHours = "总学习时长必须大于 0";
  }

  if (Number.isNaN(startDate.getTime())) {
    errors.startDate = "请选择开始日期";
  }

  if (Number.isNaN(deadline.getTime())) {
    errors.deadline = "请选择截止日期";
  } else if (!Number.isNaN(startDate.getTime()) && deadline <= startDate) {
    errors.deadline = "截止日期必须晚于开始日期";
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

export function validateAvailabilityState(availability: DailyAvailability[]) {
  const enabledDays = availability.filter(
    (day) => day.enabled && day.ranges.length > 0
  );
  const errors: Partial<Record<string, string>> = {};

  if (enabledDays.length === 0) {
    errors.availability = "至少需要配置一个可学习时间段";
  }

  const flatRules: WeeklyAvailabilityRuleInput[] = [];
  for (const day of availability) {
    if (!day.enabled) continue;
    for (const range of day.ranges) {
      flatRules.push({
        weekday: day.weekday,
        startTime: range.startTime,
        endTime: range.endTime
      });
    }
  }

  const sharedValidation = validateWeeklyAvailability(flatRules);
  if (!sharedValidation.valid) {
    errors.availability = sharedValidation.errors[0]?.message;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

export function buildCreatePlanPayload(
  planInfo: PlanInfo,
  availability: DailyAvailability[]
) {
  const totalHours = Number(planInfo.totalHours);
  const totalMinutes = Math.round(totalHours * 60);

  const rules: WeeklyAvailabilityRuleInput[] = [];
  for (const day of availability) {
    if (!day.enabled) continue;
    for (const range of day.ranges) {
      rules.push({
        weekday: day.weekday,
        startTime: range.startTime,
        endTime: range.endTime
      });
    }
  }

  return {
    title: planInfo.goal.trim().slice(0, 30),
    goal: planInfo.goal.trim(),
    totalMinutes,
    startDate: planInfo.startDate,
    deadline: planInfo.deadline,
    rescheduleBufferMinutes: DEFAULT_BUFFER_MINUTES,
    availability: rules
  };
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await csrfFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const message = getErrorMessage(data) ?? "请求失败";
    throw new Error(message);
  }

  return data as T;
}

function getErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("error" in body)) return null;

  const error = body.error;

  if (!error || typeof error !== "object" || !("message" in error)) return null;

  return typeof error.message === "string" ? error.message : null;
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "long"
  }).format(new Date(value));
}

export function formatDateShort(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric"
  }).format(new Date(value));
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatWeekday(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(
    new Date(value)
  );
}

export function formatWeekLabel(value: string): string {
  const date = new Date(value);
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long"
  });
  const weekNumber = getWeekNumber(date);

  return `${formatter.format(date)} · 第 ${weekNumber} 周`;
}

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDays =
    (date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000);

  return Math.ceil((pastDays + startOfYear.getDay() + 1) / 7);
}
