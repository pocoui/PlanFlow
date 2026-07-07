"use client";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  Settings,
  Sparkles
} from "lucide-react";
import { useMemo } from "react";

import type { DashboardGeneration } from "@/lib/client/planDashboard";
import {
  buildCalendarExportUrl,
  groupSessionsByDate,
  markSessionCompleted,
  summarizeGeneratedPlan
} from "@/lib/client/planDashboard";

import { SessionCard } from "./step-review";
import {
  formatDateShort,
  formatTime,
  formatWeekLabel,
  formatWeekday
} from "./wizard-utils";

export function StepCalendarBoard({
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
