"use client";

import { CalendarDays, Download, Plus } from "lucide-react";
import Link from "next/link";

import { buildCalendarExportUrl } from "@/lib/client/planDashboard";

export interface QuickActionsProps {
  hasPlans: boolean;
  exportPlanId?: string;
  exportDisabled?: boolean;
}

export function QuickActions({
  hasPlans,
  exportPlanId,
  exportDisabled = false
}: QuickActionsProps) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">快捷操作</h2>
      <div className="flex flex-wrap gap-3">
        <ActionLink
          href="/plans/new"
          icon={Plus}
          label="创建学习计划"
          primary
        />
        <ActionLink
          href="/dashboard"
          icon={CalendarDays}
          label="学习日历"
        />
        {exportPlanId && !exportDisabled ? (
          <ActionLink
            href={buildCalendarExportUrl(exportPlanId)}
            icon={Download}
            label="导出 .ics"
          />
        ) : (
          <ActionButton
            icon={Download}
            label={hasPlans ? "暂无可导出日程" : "导出 .ics"}
            disabled
          />
        )}
      </div>
    </section>
  );
}

function ActionLink({
  href,
  icon: Icon,
  label,
  primary = false
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      className={`inline-flex flex-1 min-w-[8rem] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center text-sm font-semibold shadow-sm transition sm:flex-initial ${
        primary
          ? "border-primary bg-primary text-primaryForeground hover:bg-teal-800"
          : "border-border bg-white text-slate-700 hover:border-primary hover:text-primary"
      }`}
      href={href}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

function ActionButton({
  icon: Icon,
  label,
  disabled
}: {
  icon: React.ElementType;
  label: string;
  disabled: boolean;
}) {
  return (
    <button
      className="inline-flex flex-1 min-w-[8rem] cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-400 shadow-sm sm:flex-initial"
      disabled={disabled}
      type="button"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
