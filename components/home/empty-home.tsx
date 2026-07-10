"use client";

import { CalendarDays, Plus, Sparkles, Target } from "lucide-react";
import Link from "next/link";

export function EmptyHome() {
  return (
    <div className="flex flex-col items-center gap-6 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-10 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <CalendarDays className="h-8 w-8" />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-slate-900">把学习目标，排进你的真实日历</h2>
        <p className="max-w-sm text-sm text-slate-500">
          输入学习目标，AI 自动拆解任务，并结合飞书忙闲生成可执行学习日程。
        </p>
      </div>

      <div className="grid w-full max-w-md grid-cols-3 gap-3">
        <Step icon={Target} label="输入目标" />
        <Step icon={Sparkles} label="AI 拆解" />
        <Step icon={CalendarDays} label="同步日历" />
      </div>

      <div className="flex flex-col gap-2 text-xs text-slate-400">
        <p>后续可授权飞书读取忙闲，并一键同步到飞书日历。</p>
      </div>

      <Link
        className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primaryForeground shadow-sm transition hover:bg-teal-800"
        href="/plans/new"
      >
        <Plus className="h-4 w-4" />
        创建学习计划
      </Link>
    </div>
  );
}

function Step({
  icon: Icon,
  label
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 bg-white p-3">
      <Icon className="h-5 w-5 text-primary" />
      <span className="text-xs font-medium text-slate-600">{label}</span>
    </div>
  );
}
