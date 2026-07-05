"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Loader2,
  RotateCcw,
  Settings,
  Sparkles,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { validateWeeklyAvailability } from "@planflow/shared";
import type { WeeklyAvailabilityRuleInput } from "@planflow/shared";

import type { CreatedPlanResponse } from "@/lib/client/planCreation";
import type {
  DashboardBusySlot,
  DashboardGeneration,
  DashboardSession,
  DashboardTask,
  SessionReviewPayload
} from "@/lib/client/planDashboard";
import {
  buildCalendarExportUrl,
  groupSessionsByDate,
  markSessionCompleted,
  submitSessionReview,
  summarizeGeneratedPlan
} from "@/lib/client/planDashboard";

// 与 Vue3 对比：
// - useState 相当于 ref/reactive，管理组件局部状态
// - useMemo 相当于 computed，缓存派生数据
// - useCallback 相当于 methods 的稳定引用，避免子组件不必要重渲染
// 企业中复杂 Wizard 通常会用 Context 或 Zustand（类似 Pinia）做跨组件状态共享。

export type WizardStep =
  | "plan-info"
  | "availability"
  | "busy-sync"
  | "task-confirm"
  | "calendar-board"
  | "review";

interface PlanInfo {
  goal: string;
  totalHours: string;
  startDate: string;
  deadline: string;
}

interface DailyAvailability {
  weekday: number;
  label: string;
  enabled: boolean;
  ranges: { startTime: string; endTime: string }[];
}

interface WizardState {
  planInfo: PlanInfo;
  availability: DailyAvailability[];
  planId: string | null;
  generation: DashboardGeneration | null;
  selectedSessionId: string | null;
}

const stepOrder: WizardStep[] = [
  "plan-info",
  "availability",
  "busy-sync",
  "task-confirm",
  "calendar-board",
  "review"
];

const stepLabels: Record<WizardStep, string> = {
  "plan-info": "创建学习计划",
  availability: "每周可学习时间",
  "busy-sync": "飞书忙闲同步",
  "task-confirm": "AI任务拆解确认",
  "calendar-board": "内部日历排程看板",
  review: "学习复盘与顺延"
};

const DEFAULT_BUFFER_MINUTES = 15;

const initialPlanInfo: PlanInfo = {
  goal: "",
  totalHours: "60",
  startDate: "",
  deadline: ""
};

const initialAvailability: DailyAvailability[] = [
  { weekday: 1, label: "周一", enabled: true, ranges: [{ startTime: "20:00", endTime: "22:00" }] },
  { weekday: 2, label: "周二", enabled: true, ranges: [{ startTime: "09:00", endTime: "12:00" }, { startTime: "20:00", endTime: "22:00" }] },
  { weekday: 3, label: "周三", enabled: true, ranges: [{ startTime: "20:00", endTime: "22:00" }] },
  { weekday: 4, label: "周四", enabled: true, ranges: [{ startTime: "20:00", endTime: "22:00" }] },
  { weekday: 5, label: "周五", enabled: true, ranges: [{ startTime: "09:00", endTime: "11:00" }, { startTime: "20:00", endTime: "22:00" }] },
  { weekday: 6, label: "周六", enabled: false, ranges: [] },
  { weekday: 0, label: "周日", enabled: false, ranges: [] }
];

export function PlanWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>("plan-info");
  const [state, setState] = useState<WizardState>({
    planInfo: initialPlanInfo,
    availability: initialAvailability,
    planId: null,
    generation: null,
    selectedSessionId: null
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "info" | "error";
    text: string;
  } | null>(null);

  const currentIndex = stepOrder.indexOf(currentStep);

  const canGoNext =
    currentStep === "plan-info"
      ? validatePlanInfo(state.planInfo).valid
      : currentStep === "availability"
        ? validateAvailabilityState(state.availability).valid
        : currentStep === "busy-sync"
          ? !!state.planId
          : currentStep === "task-confirm"
            ? !!state.generation
            : true;

  const setPlanInfo = useCallback((patch: Partial<PlanInfo>) => {
    setState((prev) => ({
      ...prev,
      planInfo: { ...prev.planInfo, ...patch }
    }));
  }, []);

  const setAvailability = useCallback(
    (availability: DailyAvailability[]) => {
      setState((prev) => ({ ...prev, availability }));
    },
    []
  );

  function showError(text: string) {
    setMessage({ type: "error", text });
  }

  function showInfo(text: string) {
    setMessage({ type: "info", text });
  }

  async function handleCreatePlan() {
    const planValidation = validatePlanInfo(state.planInfo);
    const availabilityValidation = validateAvailabilityState(state.availability);

    if (!planValidation.valid) {
      showError(Object.values(planValidation.errors)[0] ?? "表单填写不完整");
      return;
    }

    if (!availabilityValidation.valid) {
      showError(
        Object.values(availabilityValidation.errors)[0] ?? "可用时间配置不正确"
      );
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const payload = buildCreatePlanPayload(state.planInfo, state.availability);
      const plan = await postJson<CreatedPlanResponse>("/api/plans", payload);
      setState((prev) => ({ ...prev, planId: plan.id }));
      showInfo("计划创建成功，下一步同步飞书忙闲时间。");
      setCurrentStep("busy-sync");
    } catch (error) {
      showError(error instanceof Error ? error.message : "创建计划失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateSchedule() {
    if (!state.planId) return;

    setLoading(true);
    setMessage(null);

    try {
      const generation = await postJson<DashboardGeneration>(
        `/api/plans/${state.planId}/generate`,
        undefined
      );
      setState((prev) => ({ ...prev, generation }));
      showInfo("排程生成成功，请确认任务拆解。");
      setCurrentStep("task-confirm");
    } catch (error) {
      showError(error instanceof Error ? error.message : "生成排程失败");
    } finally {
      setLoading(false);
    }
  }

  function goNext() {
    if (currentStep === "availability") {
      void handleCreatePlan();
      return;
    }

    const next = stepOrder[currentIndex + 1];
    if (next) setCurrentStep(next);
  }

  function goBack() {
    const prev = stepOrder[currentIndex - 1];
    if (prev) setCurrentStep(prev);
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            创建新计划
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {stepLabels[currentStep]}
          </h1>
        </div>

        <StepHeader currentStep={currentStep} />

        {message ? (
          <div
            className={`mb-5 rounded-lg border p-3 text-sm ${
              message.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-primary/20 bg-primary/5 text-primary"
            }`}
          >
            {message.type === "error" ? (
              <AlertCircle className="mr-1 inline h-4 w-4" />
            ) : null}
            {message.text}
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {currentStep === "plan-info" ? (
            <StepPlanInfo planInfo={state.planInfo} onChange={setPlanInfo} />
          ) : null}

          {currentStep === "availability" ? (
            <StepAvailability
              availability={state.availability}
              onChange={setAvailability}
            />
          ) : null}

          {currentStep === "busy-sync" ? (
            <StepBusySync
              availability={state.availability}
              planId={state.planId}
              onSync={() => handleGenerateSchedule()}
              onSkip={() => handleGenerateSchedule()}
            />
          ) : null}

          {currentStep === "task-confirm" && state.generation ? (
            <StepTaskConfirm
              generation={state.generation}
              planInfo={state.planInfo}
            />
          ) : null}

          {currentStep === "calendar-board" && state.generation ? (
            <StepCalendarBoard
              generation={state.generation}
              totalHours={Number(state.planInfo.totalHours) || 0}
              onReview={(sessionId) =>
                setState((prev) => ({ ...prev, selectedSessionId: sessionId }))
              }
            />
          ) : null}

          {currentStep === "review" && state.generation ? (
            <StepReview
              generation={state.generation}
              onReview={(sessionId) =>
                setState((prev) => ({ ...prev, selectedSessionId: sessionId }))
              }
            />
          ) : null}
        </div>

        <WizardFooter
          currentStep={currentStep}
          canGoNext={canGoNext && !loading}
          loading={loading}
          onBack={goBack}
          onNext={goNext}
        />
      </div>

      {state.selectedSessionId && state.generation ? (
        <ReviewDialog
          session={
            state.generation.sessions.find(
              (s) => s.id === state.selectedSessionId
            ) ?? null
          }
          taskTitle={
            state.generation.tasks.find((t) => {
              const session = state.generation?.sessions.find(
                (s) => s.id === state.selectedSessionId
              );
              return session?.taskId === t.id;
            })?.title ?? "学习任务"
          }
          onClose={() =>
            setState((prev) => ({ ...prev, selectedSessionId: null }))
          }
          onSubmit={async (payload, action) => {
            if (action === "skip") {
              setState((prev) => ({ ...prev, selectedSessionId: null }));
              showInfo("已记录复盘，未进行顺延。");
              return;
            }

            const result = await submitSessionReview(
              state.selectedSessionId!,
              payload
            );
            setState((prev) => {
              if (!prev.generation) return prev;

              return {
                ...prev,
                generation: {
                  ...prev.generation,
                  sessions: [
                    ...prev.generation.sessions.map((s) =>
                      s.id === state.selectedSessionId
                        ? { ...s, status: "rescheduled" as const }
                        : s
                    ),
                    ...result.rescheduledSessions
                  ],
                  warnings: [...prev.generation.warnings, ...result.warnings]
                }
              };
            });
            setState((prev) => ({ ...prev, selectedSessionId: null }));
            showInfo("复盘已提交，剩余任务已顺延。");
          }}
        />
      ) : null}
    </main>
  );
}

function StepHeader({ currentStep }: { currentStep: WizardStep }) {
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="relative flex items-start justify-between">
        {stepOrder.map((step, index) => {
          const active = index === currentIndex;
          const completed = index < currentIndex;
          const isLast = index === stepOrder.length - 1;

          return (
            <div
              key={step}
              className="relative flex flex-1 flex-col items-center"
            >
              {!isLast ? (
                <div
                  className={`absolute left-1/2 top-4 h-0.5 w-full ${
                    completed && !active ? "bg-primary" : "bg-slate-200"
                  }`}
                />
              ) : null}

              <div
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                  active
                    ? "border-primary bg-primary text-white"
                    : completed
                      ? "border-primary bg-white text-primary"
                      : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {completed ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={`mt-2 hidden text-center text-xs font-medium sm:block ${
                  active
                    ? "text-primary"
                    : completed
                      ? "text-slate-700"
                      : "text-slate-400"
                }`}
              >
                {stepLabels[step]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WizardFooter({
  currentStep,
  canGoNext,
  loading,
  onBack,
  onNext
}: {
  currentStep: WizardStep;
  canGoNext: boolean;
  loading: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const currentIndex = stepOrder.indexOf(currentStep);
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === stepOrder.length - 1;

  return (
    <div className="mt-6 flex items-center justify-between">
      <button
        className="inline-flex h-11 items-center gap-1 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-primary hover:text-primary disabled:opacity-50"
        disabled={isFirst || loading}
        type="button"
        onClick={onBack}
      >
        <ChevronLeft className="h-4 w-4" />
        上一步
      </button>

      {isLast ? (
        <span className="text-sm text-slate-500">流程结束</span>
      ) : (
        <button
          className="inline-flex h-11 items-center gap-1 rounded-lg bg-primary px-6 text-sm font-semibold text-primaryForeground shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!canGoNext || loading}
          type="button"
          onClick={onNext}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              下一步
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

function StepPlanInfo({
  planInfo,
  onChange
}: {
  planInfo: PlanInfo;
  onChange: (patch: Partial<PlanInfo>) => void;
}) {
  const validation = validatePlanInfo(planInfo);

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-sm text-slate-600">
        告诉我们你的学习目标，AI 将为你生成个性化排程。
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          className="sm:col-span-2"
          label="学习目标"
          error={validation.errors.goal}
        >
          <input
            className="input"
            placeholder="例如：掌握 Next.js 全栈开发"
            value={planInfo.goal}
            onChange={(e) => onChange({ goal: e.target.value })}
          />
        </Field>

        <Field label="总学习时长" error={validation.errors.totalHours}>
          <div className="flex items-center gap-2">
            <input
              className="input"
              min="0.5"
              step="0.5"
              type="number"
              value={planInfo.totalHours}
              onChange={(e) => onChange({ totalHours: e.target.value })}
            />
            <span className="text-sm text-slate-500">小时</span>
          </div>
        </Field>

        <Field label="开始日期" error={validation.errors.startDate}>
          <input
            className="input"
            type="date"
            value={planInfo.startDate}
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </Field>

        <Field label="截止日期" error={validation.errors.deadline}>
          <input
            className="input"
            type="date"
            value={planInfo.deadline}
            onChange={(e) => onChange({ deadline: e.target.value })}
          />
        </Field>
      </div>
    </section>
  );
}

function StepAvailability({
  availability,
  onChange
}: {
  availability: DailyAvailability[];
  onChange: (availability: DailyAvailability[]) => void;
}) {
  function toggleWeekday(weekday: number) {
    onChange(
      availability.map((day) =>
        day.weekday === weekday
          ? {
              ...day,
              enabled: !day.enabled,
              ranges: !day.enabled ? [{ startTime: "20:00", endTime: "22:00" }] : day.ranges
            }
          : day
      )
    );
  }

  function addRange(weekday: number) {
    onChange(
      availability.map((day) =>
        day.weekday === weekday
          ? {
              ...day,
              ranges: [...day.ranges, { startTime: "20:00", endTime: "22:00" }]
            }
          : day
      )
    );
  }

  function updateRange(
    weekday: number,
    rangeIndex: number,
    patch: Partial<{ startTime: string; endTime: string }>
  ) {
    onChange(
      availability.map((day) =>
        day.weekday === weekday
          ? {
              ...day,
              ranges: day.ranges.map((range, index) =>
                index === rangeIndex ? { ...range, ...patch } : range
              )
            }
          : day
      )
    );
  }

  function removeRange(weekday: number, rangeIndex: number) {
    onChange(
      availability.map((day) =>
        day.weekday === weekday
          ? { ...day, ranges: day.ranges.filter((_, index) => index !== rangeIndex) }
          : day
      )
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-sm text-slate-600">
        选择你每周可投入学习的时间段，AI 将在这些时间内安排学习任务。
      </div>

      <div className="flex flex-col gap-3">
        {availability.map((day) => (
          <div
            key={day.weekday}
            className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4"
          >
            <div className="flex w-24 shrink-0 items-center gap-3">
              <Switch
                checked={day.enabled}
                onChange={() => toggleWeekday(day.weekday)}
              />
              <span className="font-medium text-slate-700">{day.label}</span>
            </div>

            {day.enabled ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {day.ranges.map((range, rangeIndex) => (
                  <div
                    key={rangeIndex}
                    className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1"
                  >
                    <input
                      className="w-20 rounded border border-slate-200 px-1 py-0.5 text-sm"
                      type="time"
                      value={range.startTime}
                      onChange={(e) =>
                        updateRange(day.weekday, rangeIndex, {
                          startTime: e.target.value
                        })
                      }
                    />
                    <span className="text-slate-400">-</span>
                    <input
                      className="w-20 rounded border border-slate-200 px-1 py-0.5 text-sm"
                      type="time"
                      value={range.endTime}
                      onChange={(e) =>
                        updateRange(day.weekday, rangeIndex, {
                          endTime: e.target.value
                        })
                      }
                    />
                    <button
                      className="text-slate-400 hover:text-red-600"
                      type="button"
                      onClick={() => removeRange(day.weekday, rangeIndex)}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  className="small-action"
                  type="button"
                  onClick={() => addRange(day.weekday)}
                >
                  + 添加时间
                </button>
              </div>
            ) : (
              <span className="text-sm text-slate-400">未设置</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function StepBusySync({
  availability,
  planId,
  onSync,
  onSkip
}: {
  availability: DailyAvailability[];
  planId: string | null;
  onSync: () => void;
  onSkip: () => void;
}) {
  const [slots, setSlots] = useState<DashboardBusySlot[]>([]);
  const [loading, setLoading] = useState(false);

  async function sync() {
    if (!planId) return;

    setLoading(true);
    try {
      const result = await fetch(`/api/plans/${planId}/busy-slots?start=&end=`);
      const data = (await result.json()) as {
        busySlots?: DashboardBusySlot[];
      };
      setSlots(data.busySlots ?? []);
      onSync();
    } catch {
      onSync();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-sm text-slate-600">
        同步飞书日历，AI 将扣除忙碌时间并计算真实可用学习时间。
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <BusyPanel title="可学习时间" type="available">
          <div className="space-y-2 text-sm">
            {availability.map((day) => (
              <BusyRow
                key={day.weekday}
                weekday={day.label}
                text={
                  day.enabled && day.ranges.length > 0
                    ? day.ranges.map((r) => `${r.startTime}-${r.endTime}`).join("、")
                    : "无"
                }
              />
            ))}
          </div>
        </BusyPanel>

        <BusyPanel title="扣除冲突后真实可用时间" type="result">
          <div className="space-y-2 text-sm">
            {availability.map((day) => (
              <BusyRow
                key={day.weekday}
                weekday={day.label}
                text={
                  day.enabled && day.ranges.length > 0
                    ? day.ranges.map((r) => `${r.startTime}-${r.endTime}`).join("、")
                    : "无"
                }
              />
            ))}
          </div>
        </BusyPanel>

        <BusyPanel title="飞书忙碌时间" type="busy">
          <div className="space-y-2 text-sm">
            {slots.length === 0 ? (
              <>
                <BusyRow weekday="周一" text="09:00 - 10:30 临时会议" />
                <BusyRow weekday="周三" text="10:30 - 12:00 团队周会" />
              </>
            ) : (
              slots.map((slot) => (
                <BusyRow
                  key={slot.id}
                  weekday={formatWeekday(slot.startAt)}
                  text={`${formatTime(slot.startAt)} - ${formatTime(slot.endAt)} ${slot.title}`}
                />
              ))
            )}
          </div>
        </BusyPanel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-primary" />
            可学习时间
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-red-400" />
            忙碌时间
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded-sm bg-emerald-400" />
            可用时间
          </span>
        </div>

        <div className="flex gap-3">
          <button
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-primary"
            disabled={loading || !planId}
            type="button"
            onClick={() => onSkip()}
          >
            跳过同步
          </button>
          <button
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primaryForeground shadow-sm transition hover:bg-teal-800 disabled:opacity-60"
            disabled={loading || !planId}
            type="button"
            onClick={() => sync()}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            重新同步
          </button>
        </div>
      </div>
    </section>
  );
}

function BusyPanel({
  children,
  title,
  type
}: {
  children: React.ReactNode;
  title: string;
  type: "available" | "busy" | "result";
}) {
  const colors = {
    available: "border-primary/20 bg-primary/5",
    busy: "border-red-100 bg-red-50",
    result: "border-emerald-100 bg-emerald-50"
  };

  return (
    <div className={`rounded-lg border p-4 ${colors[type]}`}>
      <h3 className="mb-3 text-sm font-bold text-slate-800">{title}</h3>
      {children}
    </div>
  );
}

function BusyRow({ weekday, text }: { weekday: string; text: string }) {
  return (
    <div className="flex items-start gap-3 text-slate-700">
      <span className="w-10 shrink-0 font-medium">{weekday}</span>
      <span>{text}</span>
    </div>
  );
}

function StepTaskConfirm({
  generation,
  planInfo
}: {
  generation: DashboardGeneration;
  planInfo: PlanInfo;
}) {
  const totalHours = Number(planInfo.totalHours) || 0;
  const groupedByPhase = useMemo(() => {
    const groups = new Map<string, DashboardTask[]>();

    for (const task of generation.tasks) {
      const phase = task.phase || "其他";
      const list = groups.get(phase) ?? [];
      list.push(task);
      groups.set(phase, list);
    }

    return Array.from(groups.entries());
  }, [generation.tasks]);

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-sm text-slate-600">
        <div className="flex flex-wrap gap-4">
          <span>
            总计：<strong className="text-slate-900">{totalHours} 小时</strong>
          </span>
          <span>
            日期：
            <strong className="text-slate-900">
              {planInfo.startDate || "—"} 至 {planInfo.deadline || "—"}
            </strong>
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">阶段</th>
              <th className="px-4 py-3 text-left">任务</th>
              <th className="px-4 py-3 text-left">预计时长</th>
              <th className="px-4 py-3 text-left">验收标准</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groupedByPhase.map(([phase, tasks]) =>
              tasks.map((task, index) => (
                <tr key={task.id} className="bg-white hover:bg-slate-50/50">
                  {index === 0 ? (
                    <td
                      className="border-r border-slate-100 bg-slate-50 px-4 py-3 align-top font-semibold text-slate-700"
                      rowSpan={tasks.length}
                    >
                      {phase}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {task.title}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {Math.round(task.estimatedMinutes / 6) / 10} 小时
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {task.acceptanceCriteria && task.acceptanceCriteria.length > 0
                      ? task.acceptanceCriteria.join("；")
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {generation.warnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 text-sm font-semibold text-amber-900">注意</div>
          <div className="space-y-1 text-sm text-amber-800">
            {generation.warnings.map((warning, index) => (
              <p key={`${warning.code}-${warning.taskId ?? "plan"}-${index}`}>
                {warning.message}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function StepCalendarBoard({
  generation,
  totalHours,
  onReview
}: {
  generation: DashboardGeneration;
  totalHours: number;
  onReview: (sessionId: string) => void;
}) {
  const summary = useMemo(
    () => summarizeGeneratedPlan(generation),
    [generation]
  );
  const grouped = useMemo(
    () => groupSessionsByDate(generation.sessions),
    [generation.sessions]
  );
  const today = new Date().toISOString().slice(0, 10);
  const taskTitleById = useMemo(
    () => new Map(generation.tasks.map((t) => [t.id, t.title])),
    [generation.tasks]
  );

  const weekDates = useMemo(() => {
    if (grouped.length === 0) return [];
    return grouped.map((g) => g.date).slice(0, 7);
  }, [grouped]);

  const timeSlots = [
    "全天",
    "08:00",
    "09:00",
    "10:00",
    "12:00",
    "14:00",
    "16:00",
    "18:00",
    "20:00",
    "22:00"
  ];

  return (
    <section className="flex flex-col gap-5 lg:flex-row">
      {/* 左侧日历 */}
      <div className="flex flex-1 flex-col gap-5">
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-sm text-slate-600">
          查看本周学习排程，点击学习日程可标记完成或进行复盘。
        </div>

        {/* 顶部工具栏 */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:border-primary">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-primary">
              今天
            </button>
            <button className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:border-primary">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="text-sm font-semibold text-slate-800">
            {weekDates.length > 0 ? formatWeekLabel(weekDates[0]) : "暂无日程"}
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700">
              周视图
            </button>
            <button className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:border-primary">
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 周日历网格 */}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <div className="min-w-[800px]">
            <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <div className="border-r border-slate-200 p-2">时间</div>
              {weekDates.map((date) => (
                <div
                  key={date}
                  className={`border-r border-slate-200 p-2 text-center last:border-r-0 ${
                    date === today ? "bg-primary/5 text-primary" : ""
                  }`}
                >
                  <div>{formatWeekday(date)}</div>
                  <div className="text-[10px]">{formatDateShort(date)}</div>
                </div>
              ))}
            </div>

            {timeSlots.map((time) => (
              <div
                key={time}
                className="grid grid-cols-8 border-b border-slate-100 last:border-b-0"
              >
                <div className="border-r border-slate-200 p-2 text-xs text-slate-500">
                  {time}
                </div>
                {weekDates.map((date) => {
                  const cellSessions = generation.sessions.filter((s) => {
                    const sTime = formatTime(s.startAt);
                    return s.startAt.slice(0, 10) === date && sTime === time;
                  });

                  return (
                    <div
                      key={`${date}-${time}`}
                      className="min-h-[60px] border-r border-slate-100 p-1 last:border-r-0"
                    >
                      {cellSessions.map((session) => (
                        <div
                          key={session.id}
                          className={`mb-1 cursor-pointer rounded px-2 py-1 text-[10px] ${
                            session.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : session.status === "rescheduled"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-primary/10 text-primary"
                          }`}
                          onClick={() => onReview(session.id)}
                        >
                          {taskTitleById.get(session.taskId) ?? "学习"}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* 底部操作 */}
        <div className="flex flex-wrap justify-end gap-3">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-primary disabled:opacity-50"
            disabled
            type="button"
          >
            <RotateCcw className="h-4 w-4" />
            同步飞书
          </button>
          <a
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primaryForeground shadow-sm transition hover:bg-teal-800"
            href={buildCalendarExportUrl(generation.planId)}
          >
            <Download className="h-4 w-4" />
            导出 .ics
          </a>
        </div>
      </div>

      {/* 右侧边栏 */}
      <div className="flex w-full flex-col gap-5 lg:w-80">
        {/* 今日任务 */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
            <Sparkles className="h-4 w-4 text-primary" />
            今日任务
          </h3>
          <div className="flex flex-col gap-2">
            {generation.sessions
              .filter((s) => s.startAt.slice(0, 10) === today)
              .map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  taskTitle={taskTitleById.get(session.taskId) ?? "学习"}
                  onComplete={async () => markSessionCompleted(session.id)}
                  onReview={() => onReview(session.id)}
                />
              ))}
            {generation.sessions.filter((s) => s.startAt.slice(0, 10) === today)
              .length === 0 ? (
              <p className="text-sm text-slate-500">今天没有学习日程。</p>
            ) : null}
          </div>
        </div>

        {/* 进度模块 */}
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-800">总进度</h3>
          <div className="mb-2 flex items-center gap-3">
            <div className="relative h-14 w-14">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="text-primary"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray={`${summary.progressPercent}, 100`}
                  strokeWidth="3"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                {summary.progressPercent}%
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">
                {summary.completedHours} / {totalHours} 小时
              </div>
              <div className="text-xs text-slate-500">已完成学习时长</div>
            </div>
          </div>

          <div className="space-y-3">
            {generation.tasks.map((task) => {
              const taskSessions = generation.sessions.filter(
                (s) => s.taskId === task.id
              );
              const taskCompleted = taskSessions.filter(
                (s) => s.status === "completed"
              ).length;
              const taskProgress =
                taskSessions.length > 0
                  ? Math.round((taskCompleted / taskSessions.length) * 100)
                  : 0;

              return (
                <div key={task.id}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-slate-700">{task.title}</span>
                    <span className="text-slate-500">{taskProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: `${taskProgress}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

function StepReview({
  generation,
  onReview
}: {
  generation: DashboardGeneration;
  onReview: (sessionId: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = generation.sessions.filter(
    (s) => s.startAt.slice(0, 10) === today
  );
  const completedCount = generation.sessions.filter(
    (s) => s.status === "completed"
  ).length;
  const progress =
    generation.sessions.length > 0
      ? Math.round((completedCount / generation.sessions.length) * 100)
      : 0;

  return (
    <section className="flex flex-col gap-5 lg:flex-row">
      <div className="flex flex-1 flex-col gap-5">
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-sm text-slate-600">
          回顾今日学习情况，对未完成或部分完成的日程进行复盘和重新排程。
        </div>

        <div className="flex items-center gap-5 rounded-lg border border-slate-200 bg-white p-5">
          <div className="relative h-20 w-20">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="text-primary"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray={`${progress}, 100`}
                strokeWidth="3"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-base font-bold">
              {progress}%
            </span>
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">总进度</div>
            <div className="text-sm text-slate-600">
              已完成 {completedCount} / {generation.sessions.length} 个日程
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-800">今日日程</h3>
          {todaySessions.length === 0 ? (
            <p className="text-sm text-slate-500">今天没有学习日程。</p>
          ) : (
            <div className="flex flex-col gap-2">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 p-3"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800">
                      {formatTime(session.startAt)} -{" "}
                      {formatTime(session.endAt)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {session.status === "completed" ? "已完成" : "待复盘"}
                    </div>
                  </div>
                  {session.status !== "completed" ? (
                    <button
                      className="small-action"
                      type="button"
                      onClick={() => onReview(session.id)}
                    >
                      复盘
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-full rounded-lg border border-slate-200 bg-white p-4 lg:w-80">
        <h3 className="mb-4 text-sm font-bold text-slate-800">进度细分</h3>
        <div className="space-y-4">
          {generation.tasks.map((task) => {
            const taskSessions = generation.sessions.filter(
              (s) => s.taskId === task.id
            );
            const taskCompleted = taskSessions.filter(
              (s) => s.status === "completed"
            ).length;
            const taskProgress =
              taskSessions.length > 0
                ? Math.round((taskCompleted / taskSessions.length) * 100)
                : 0;

            return (
              <div key={task.id}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-700">{task.title}</span>
                  <span className="text-slate-500">{taskProgress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-primary transition-all"
                    style={{ width: `${taskProgress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function SessionCard({
  session,
  taskTitle,
  onComplete,
  onReview
}: {
  session: DashboardSession;
  taskTitle: string;
  onComplete: () => void;
  onReview: () => void;
}) {
  const isCompleted = session.status === "completed";
  const isRescheduled = session.status === "rescheduled";

  return (
    <div
      className={`rounded-md p-3 text-sm ${
        isCompleted
          ? "bg-emerald-50 text-emerald-800"
          : isRescheduled
            ? "bg-amber-50 text-amber-800"
            : "bg-slate-50 text-slate-700"
      }`}
    >
      <div className="font-medium">{taskTitle}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <Clock className="h-3 w-3" />
        {formatTime(session.startAt)} - {formatTime(session.endAt)}
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            isCompleted
              ? "bg-emerald-100 text-emerald-700"
              : isRescheduled
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-200 text-slate-600"
          }`}
        >
          {session.status}
        </span>
      </div>
      {session.status === "scheduled" ? (
        <div className="mt-2 flex gap-2">
          <button className="small-action" type="button" onClick={onComplete}>
            完成
          </button>
          <button className="small-action" type="button" onClick={onReview}>
            复盘
          </button>
        </div>
      ) : null}
    </div>
  );
}

function ReviewDialog({
  session,
  taskTitle,
  onClose,
  onSubmit
}: {
  session: DashboardSession | null;
  taskTitle: string;
  onSubmit: (
    payload: SessionReviewPayload,
    action: "reschedule" | "skip" | "custom"
  ) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<SessionReviewPayload["result"]>(
    "not_completed"
  );
  const [actualMinutes, setActualMinutes] = useState(
    Math.floor((session?.durationMinutes ?? 60) / 2)
  );
  const [remainingMinutes, setRemainingMinutes] = useState(
    Math.ceil((session?.durationMinutes ?? 60) / 2)
  );
  const [reason, setReason] = useState("临时有事，时间不足");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (result === "completed") {
      setActualMinutes(session?.durationMinutes ?? 60);
      setRemainingMinutes(0);
    }
  }, [result, session?.durationMinutes]);

  async function handleSubmit(action: "reschedule" | "skip" | "custom") {
    setSubmitting(true);

    try {
      await onSubmit(
        {
          result,
          actualMinutes,
          remainingMinutes: result === "completed" ? 0 : remainingMinutes,
          reason: reason || undefined,
          continueTask: result !== "completed" && result !== "skipped"
        },
        action
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">复盘本次学习任务</h3>
          <button
            className="rounded-md p-1 text-slate-500 transition hover:text-slate-800"
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="font-medium text-slate-800">{taskTitle}</div>
          <div className="mt-1 text-slate-600">
            {session ? formatDate(session.startAt) : "—"} ·{" "}
            {session
              ? `${formatTime(session.startAt)} - ${formatTime(session.endAt)}`
              : "—"}
          </div>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit("reschedule");
          }}
        >
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">完成情况</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "completed", label: "已完成" },
                { value: "partial", label: "部分完成" },
                { value: "not_completed", label: "未完成" },
                { value: "skipped", label: "跳过" }
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    result === option.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-slate-200 text-slate-700 hover:border-primary"
                  }`}
                >
                  <input
                    checked={result === option.value}
                    className="h-4 w-4 accent-primary"
                    name="review-result"
                    type="radio"
                    value={option.value}
                    onChange={(e) =>
                      setResult(e.target.value as SessionReviewPayload["result"])
                    }
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">
              实际学习时长（分钟）
            </span>
            <input
              className="input"
              min="0"
              type="number"
              value={actualMinutes}
              onChange={(e) => setActualMinutes(Number(e.target.value))}
            />
          </label>

          {result !== "completed" ? (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-slate-700">
                剩余时长（分钟）
              </span>
              <input
                className="input"
                min="0"
                type="number"
                value={remainingMinutes}
                onChange={(e) => setRemainingMinutes(Number(e.target.value))}
              />
            </label>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">
              原因（可选）
            </span>
            <textarea
              className="input min-h-16 resize-y"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">顺延建议（AI 计算）</div>
            <div className="mt-1 text-sm font-medium text-slate-800">
              顺延到最近的可用时间段
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              className="small-action"
              disabled={submitting}
              type="button"
              onClick={() => handleSubmit("skip")}
            >
              不顺延
            </button>
            <button
              className="small-action"
              disabled={submitting}
              type="button"
              onClick={() => handleSubmit("custom")}
            >
              顺延到其他时间
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primaryForeground transition hover:bg-teal-800 disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              确认顺延
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Switch({
  checked,
  onChange
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      aria-pressed={checked}
      className={`relative h-6 w-11 rounded-full transition ${
        checked ? "bg-primary" : "bg-slate-300"
      }`}
      type="button"
      onClick={onChange}
    >
      <span
        className={`absolute top-1 block h-4 w-4 rounded-full bg-white transition ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

function Field({
  children,
  className = "",
  error,
  label
}: {
  children: React.ReactNode;
  className?: string;
  error?: string;
  label: string;
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error ? (
        <span className="inline-flex items-center gap-1 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          {error}
        </span>
      ) : null}
    </label>
  );
}

function validatePlanInfo(planInfo: PlanInfo) {
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

function validateAvailabilityState(availability: DailyAvailability[]) {
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

function buildCreatePlanPayload(
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

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "long"
  }).format(new Date(value));
}

function formatDateShort(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric"
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatWeekday(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "long" }).format(
    new Date(value)
  );
}

function formatWeekLabel(value: string): string {
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
