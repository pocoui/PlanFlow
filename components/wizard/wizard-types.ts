import type { GeneratedTask } from "@/lib/client/planCreation";
import type { DashboardGeneration } from "@/lib/client/planDashboard";

export type WizardStep =
  | "plan-info"
  | "availability"
  | "task-confirm"
  | "calendar-board"
  | "review";

export interface PlanInfo {
  goal: string;
  totalHours: string;
  startDate: string;
  deadline: string;
}

export interface DailyAvailability {
  weekday: number;
  label: string;
  enabled: boolean;
  ranges: { startTime: string; endTime: string }[];
}

export interface WizardState {
  planInfo: PlanInfo;
  availability: DailyAvailability[];
  planId: string | null;
  tasks: GeneratedTask[] | null;
  generation: DashboardGeneration | null;
  selectedSessionId: string | null;
}

export const stepOrder: WizardStep[] = [
  "plan-info",
  "availability",
  "task-confirm",
  "calendar-board",
  "review"
];

export const stepLabels: Record<WizardStep, string> = {
  "plan-info": "创建学习计划",
  availability: "每周可学习时间",
  "task-confirm": "AI任务拆解确认",
  "calendar-board": "内部日历排程看板",
  review: "学习复盘与顺延"
};

export const DEFAULT_BUFFER_MINUTES = 15;
