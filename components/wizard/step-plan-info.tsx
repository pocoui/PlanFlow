"use client";

import { AlertCircle } from "lucide-react";

import type { PlanInfo } from "./wizard-types";
import { validatePlanInfo } from "./wizard-utils";

export function Field({
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

export function Switch({
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

export function StepPlanInfo({
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
            suppressHydrationWarning
            onChange={(e) => onChange({ startDate: e.target.value })}
          />
        </Field>

        <Field label="截止日期" error={validation.errors.deadline}>
          <input
            className="input"
            type="date"
            value={planInfo.deadline}
            suppressHydrationWarning
            onChange={(e) => onChange({ deadline: e.target.value })}
          />
        </Field>
      </div>
    </section>
  );
}
