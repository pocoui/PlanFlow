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

// 将 ISO 时间字符串转为本地日期字符串（如 "2026-07-08"）
function toLocalDateStr(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// 将 ISO 时间字符串转为本地整点时间标签（如 "09:00"）
function toLocalHourLabel(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:00`;
}

// 获取某日期所在周的周一（周一为每周第一天）
function getMonday(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=周日, 1=周一, ..., 6=周六
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // 调整到周一
  return new Date(d.setDate(diff));
}

// 生成从周一开始的 7 天日期
function generateWeekDates(monday: Date): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(toLocalDateStr(d.toISOString()));
  }
  return dates;
}

// 生成小时时间槽（从 startHour 到 endHour）
function generateHourSlots(startHour: number, endHour: number): string[] {
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

// 计算 session 跨越的小时数
function getSessionHourSpan(startAt: string, endAt: string): number {
  const start = new Date(startAt);
  const end = new Date(endAt);
  const diffMs = end.getTime() - start.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60));
}

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

  const today = toLocalDateStr(new Date().toISOString());
  const taskTitleById = useMemo(
    () => new Map(generation.tasks.map((t) => [t.id, t.title])),
    [generation.tasks]
  );

  // 生成完整的周视图日期（周一到周日）
  const weekDates = useMemo(() => {
    if (generation.sessions.length === 0) return [];
    // 取第一个 session 的日期所在周的周一
    const firstSessionDate = toLocalDateStr(generation.sessions[0].startAt);
    const monday = getMonday(firstSessionDate);
    return generateWeekDates(monday);
  }, [generation.sessions]);

  // 生成连续的小时时间槽（08:00 到 22:00）
  const timeSlots = useMemo(() => {
    return generateHourSlots(8, 22);
  }, []);

  // 按日期和小时分组 sessions
  const sessionsByDateAndHour = useMemo(() => {
    const map = new Map<string, Map<string, typeof generation.sessions>>();
    for (const session of generation.sessions) {
      const date = toLocalDateStr(session.startAt);
      const hour = toLocalHourLabel(session.startAt);
      
      if (!map.has(date)) {
        map.set(date, new Map());
      }
      const dateMap = map.get(date)!;
      if (!dateMap.has(hour)) {
        dateMap.set(hour, []);
      }
      dateMap.get(hour)!.push(session);
    }
    return map;
  }, [generation.sessions]);

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
            {/* 表头：时间 + 7天 */}
            <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <div className="border-r border-slate-200 p-2 text-center">时间</div>
              {weekDates.map((date) => (
                <div
                  key={date}
                  className={`border-r border-slate-200 p-2 text-center last:border-r-0 ${
                    date === today ? "bg-primary/5 text-primary" : ""
                  }`}
                >
                  <div>{formatWeekday(date)}</div>
                  <div className="text-[10px] text-slate-500">{formatDateShort(date)}</div>
                </div>
              ))}
            </div>

            {/* 时间行 */}
            <div className="relative">
              {timeSlots.map((time) => (
                <div
                  key={time}
                  className="grid grid-cols-8 border-b border-slate-100 last:border-b-0"
                  style={{ minHeight: "60px" }}
                >
                  {/* 时间标签 */}
                  <div className="border-r border-slate-200 bg-slate-50/50 p-2 text-center text-xs text-slate-500">
                    {time}
                  </div>
                  {/* 7天列 */}
                  {weekDates.map((date) => {
                    const hourSessions = sessionsByDateAndHour.get(date)?.get(time) ?? [];
                    return (
                      <div
                        key={`${date}-${time}`}
                        className="relative border-r border-slate-100 last:border-r-0"
                      >
                        {hourSessions.map((session) => {
                          const hourSpan = getSessionHourSpan(session.startAt, session.endAt);
                          const taskTitle = taskTitleById.get(session.taskId) ?? "学习";
                          return (
                            <div
                              key={session.id}
                              className={`absolute inset-x-1 cursor-pointer rounded px-2 py-1 text-xs ${
                                session.status === "completed"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : session.status === "rescheduled"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-primary/10 text-primary"
                              }`}
                              style={{
                                top: "2px",
                                height: `calc(${hourSpan} * 60px - 4px)`,
                                zIndex: 10
                              }}
                              onClick={() => onReview(session.id)}
                              title={`${taskTitle} (${hourSpan}小时)`}
                            >
                              <div className="font-medium truncate">{taskTitle}</div>
                              {hourSpan > 1 && (
                                <div className="text-[10px] opacity-75">
                                  {formatTime(session.startAt)} - {formatTime(session.endAt)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
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
              .filter((s) => toLocalDateStr(s.startAt) === today)
              .map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  taskTitle={taskTitleById.get(session.taskId) ?? "学习"}
                  onComplete={async () => markSessionCompleted(session.id)}
                  onReview={() => onReview(session.id)}
                />
              ))}
            {generation.sessions.filter((s) => toLocalDateStr(s.startAt) === today)
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
