"use client";

import { CalendarDays, Download, TrendingUp } from "lucide-react";
import Link from "next/link";

import type { HomePlanSummary } from "@/lib/client/home";
import { buildCalendarExportUrl } from "@/lib/client/planDashboard";

export interface PlanProgressCardProps {
  plan: HomePlanSummary;
}

export function PlanProgressCard({ plan }: PlanProgressCardProps) {
  const completedHours = minutesToHours(plan.completedMinutes);
  const totalHours = minutesToHours(plan.totalMinutes);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-white p-4 shadow-sm">
      <Link
        className="group flex items-start justify-between gap-3"
        href={`/dashboard?planId=${encodeURIComponent(plan.id)}`}
      >
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-semibold text-slate-900 group-hover:text-primary">
            {plan.title}
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            已完成 {completedHours} / {totalHours} 小时
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <TrendingUp className="h-5 w-5" />
        </div>
      </Link>

      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${plan.progressPercent}%` }}
          />
        </div>
        <span className="text-sm font-semibold text-slate-700">
          {plan.progressPercent}%
        </span>
      </div>

      <div className="text-xs text-slate-500">
        {plan.nextSession ? (
          <span>
            {plan.nextSession.isInProgress ? (
              <>
                进行中：
                <span className="font-medium text-emerald-600">
                  {formatTime(plan.nextSession.startAt)} -{" "}
                  {formatTime(plan.nextSession.endAt)}
                </span>
              </>
            ) : (
              <>
                下次学习：
                <span className="font-medium text-primary">
                  {formatTime(plan.nextSession.startAt)}
                </span>
              </>
            )}
          </span>
        ) : (
          <span className="text-slate-400">暂无后续安排</span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-primary hover:text-primary sm:flex-initial"
          href={`/dashboard?planId=${encodeURIComponent(plan.id)}`}
        >
          <CalendarDays className="h-3.5 w-3.5" />
          查看日历
        </Link>
        <Link
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-primary hover:text-primary sm:flex-initial"
          href={buildCalendarExportUrl(plan.id)}
        >
          <Download className="h-3.5 w-3.5" />
          导出 .ics
        </Link>
      </div>
    </div>
  );
}

function minutesToHours(minutes: number): string {
  return String(Math.round((minutes / 60) * 10) / 10);
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
