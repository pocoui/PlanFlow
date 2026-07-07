"use client";

import { CheckCircle2, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import type { WizardStep } from "./wizard-types";
import { stepLabels, stepOrder } from "./wizard-types";

export function StepHeader({ currentStep }: { currentStep: WizardStep }) {
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

export function WizardFooter({
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
  const nextLabel = currentStep === "task-confirm" ? "生成排程" : "下一步";

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
              {nextLabel}
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
