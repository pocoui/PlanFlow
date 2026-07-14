"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { isApiConfigured, validateCurrentAiConfig } from "@/lib/client/aiConfig";
import {
  schedulePlan,
  type CreatedPlanResponse,
  type GeneratedTask
} from "@/lib/client/planCreation";
import type { DashboardGeneration } from "@/lib/client/planDashboard";
import { submitSessionReview } from "@/lib/client/planDashboard";

import { StepCalendarBoard } from "./wizard/step-calendar-board";
import { StepPlanInfo } from "./wizard/step-plan-info";
import { StepAvailability } from "./wizard/step-availability";
import { StepReview, ReviewDialog } from "./wizard/step-review";
import { StepTaskConfirm } from "./wizard/step-task-confirm";
import { StepHeader, WizardFooter } from "./wizard/wizard-layout";
import type { WizardStep, WizardState, PlanInfo, DailyAvailability } from "./wizard/wizard-types";
import { stepOrder } from "./wizard/wizard-types";
import {
  initialPlanInfo,
  initialAvailability,
  localDateStr,
  validatePlanInfo,
  validateAvailabilityState,
  buildCreatePlanPayload,
  postJson
} from "./wizard/wizard-utils";

// 与 Vue3 对比：
// - useState 相当于 ref/reactive，管理组件局部状态
// - useMemo 相当于 computed，缓存派生数据
// - useCallback 相当于 methods 的稳定引用，避免子组件不必要重渲染
// 企业中复杂 Wizard 通常会用 Context 或 Zustand（类似 Pinia）做跨组件状态共享。

export type { WizardStep } from "./wizard/wizard-types";

export function PlanWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>("plan-info");
  const [state, setState] = useState<WizardState>({
    planInfo: initialPlanInfo,
    availability: initialAvailability,
    planId: null,
    tasks: null,
    generation: null,
    selectedSessionId: null
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: "info" | "error";
    text: string;
  } | null>(null);

  const currentIndex = stepOrder.indexOf(currentStep);

  const canGoNext = useMemo(() => {
    if (currentStep === "plan-info") return validatePlanInfo(state.planInfo).valid;
    if (currentStep === "availability") return validateAvailabilityState(state.availability).valid;
    if (currentStep === "task-confirm") return !!state.tasks && state.tasks.length > 0;
    return true;
  }, [currentStep, state.planInfo, state.availability, state.tasks]);

  // 分层引导 · 信息提示：检测是否配置了真实 API（mock 不算已配置）
  // 必须在 useEffect 中计算，避免 SSR/客户端水合不一致
  // （isApiConfigured 读 localStorage，服务端始终返回 false）
  const [aiConfigWarning, setAiConfigWarning] = useState<string | null>(null);
  useEffect(() => {
    if (isApiConfigured()) {
      setAiConfigWarning(null);
    } else {
      setAiConfigWarning("尚未配置 AI 接口，当前将使用模拟数据生成计划。如需真正的 AI 智能排程，请先配置 OpenAI 兼容接口。");
    }
  }, []);

  // 水合后将 UTC 日期修正为客户端本地日期
  useEffect(() => {
    setState((prev) => ({
      ...prev,
      planInfo: {
        ...prev.planInfo,
        startDate: localDateStr(),
        deadline: localDateStr(7)
      }
    }));
  }, []);

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

  const setTasks = useCallback((tasks: GeneratedTask[]) => {
    setState((prev) => ({ ...prev, tasks }));
  }, []);

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

    // 分层引导 · 硬校验：openai_compatible 模式缺少凭证时阻止创建
    const aiConfigCheck = validateCurrentAiConfig();
    if (!aiConfigCheck.valid) {
      showError(aiConfigCheck.reason ?? "AI 配置无效，请前往设置页面配置。");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const payload = buildCreatePlanPayload(state.planInfo, state.availability);
      const plan = await postJson<CreatedPlanResponse>("/api/plans", payload);
      setState((prev) => ({ ...prev, planId: plan.id }));
      showInfo("计划创建成功，正在生成 AI 任务...");
      setCurrentStep("task-confirm");
    } catch (error) {
      showError(error instanceof Error ? error.message : "创建计划失败");
    } finally {
      setLoading(false);
    }
  }

  async function handleSchedule() {
    if (!state.planId || !state.tasks) return;

    setLoading(true);
    setMessage(null);

    try {
      const result = await schedulePlan(state.planId);
      const generation: DashboardGeneration = {
        planId: result.planId,
        tasks: result.tasks,
        sessions: result.sessions,
        busySlots: result.busySlots,
        warnings: result.warnings
      };
      setState((prev) => ({ ...prev, generation }));
      showInfo("排程生成成功，进入日历看板。");
      setCurrentStep("calendar-board");
    } catch (error) {
      showError(error instanceof Error ? error.message : "排程生成失败");
    } finally {
      setLoading(false);
    }
  }

  function goNext() {
    if (currentStep === "availability") {
      void handleCreatePlan();
      return;
    }

    if (currentStep === "task-confirm") {
      void handleSchedule();
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
            {{ "plan-info": "创建学习计划", availability: "每周可学习时间", "task-confirm": "AI任务拆解确认", "calendar-board": "内部日历排程看板", review: "学习复盘与顺延" }[currentStep]}
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

        {aiConfigWarning ? (
          <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">尚未配置 AI 接口</p>
                <p className="mt-1">{aiConfigWarning}</p>
                <Link
                  className="mt-2 inline-block font-semibold underline hover:text-amber-900"
                  href="/settings"
                >
                  前往设置 →
                </Link>
              </div>
            </div>
          </div>
        ) : null}

        <div className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {currentStep === "plan-info" ? (
            <StepPlanInfo planInfo={state.planInfo} onChange={setPlanInfo} />
          ) : null}

          {currentStep === "availability" ? (
            <StepAvailability
              availability={state.availability}
              onChange={setAvailability}
            />
          ) : null}

          {currentStep === "task-confirm" ? (
            <StepTaskConfirm
              planId={state.planId}
              planInfo={state.planInfo}
              tasks={state.tasks}
              loading={loading}
              onTasksLoaded={setTasks}
              onSchedule={() => void handleSchedule()}
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
