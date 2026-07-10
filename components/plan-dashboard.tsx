"use client";

import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  LayoutGrid,
  List,
  Loader2,
  RotateCcw,
  Sparkles,
  Upload,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildCalendarExportUrl,
  fetchPlanDashboard,
  groupSessionsByDate,
  isFeishuAuthRequired,
  markSessionCompleted,
  markTaskCompleted,
  submitSessionReview,
  summarizeGeneratedPlan,
  syncToCalendar
} from "@/lib/client/planDashboard";
import type {
  DashboardBusySlot,
  DashboardGeneration,
  DashboardPlan,
  DashboardSession,
  SessionReviewPayload
} from "@/lib/client/planDashboard";

function groupBusySlotsByDate(slots: DashboardBusySlot[]) {
  const grouped = new Map<string, DashboardBusySlot[]>();

  slots
    .slice()
    .sort(
      (a, b) =>
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    )
    .forEach((slot) => {
      // 使用本地日期而非 UTC 日期，避免时区偏差
      const d = new Date(slot.startAt);
      const pad = (n: number) => String(n).padStart(2, "0");
      const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const dateSlots = grouped.get(date) ?? [];
      dateSlots.push(slot);
      grouped.set(date, dateSlots);
    });

  return Array.from(grouped.entries()).map(([date, slots]) => ({
    date,
    slots
  }));
}

export interface PlanDashboardProps {
  planId?: string;
  initialReviewSessionId?: string | null;
}

type ViewState = "loading" | "ready" | "error";
type WeekViewMode = "list" | "calendar";

export function PlanDashboard({ planId, initialReviewSessionId }: PlanDashboardProps) {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [plan, setPlan] = useState<DashboardPlan | null>(null);
  const [message, setMessage] = useState("");
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(initialReviewSessionId ?? null);
  const [weekViewMode, setWeekViewMode] = useState<WeekViewMode>("list");
  const [weekOffset, setWeekOffset] = useState(0);
  const [weekOffsetInitialized, setWeekOffsetInitialized] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [authDialogUrl, setAuthDialogUrl] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setViewState("loading");
    setMessage("");

    if (!planId) {
      setMessage("未指定计划。");
      setViewState("error");
      return;
    }

    try {
      const result = await fetchPlanDashboard(planId);
      setPlan(result);
      setViewState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载计划失败。");
      setViewState("error");
    }
  }, [planId]);

  useEffect(() => {
    void loadPlan();
  }, [loadPlan]);

  useEffect(() => {
    if (!initialReviewSessionId || !plan) return;
    const session = plan.sessions.find((s) => s.id === initialReviewSessionId);
    if (!session || session.hasReview) {
      setReviewSessionId(null);
    }
  }, [plan, initialReviewSessionId]);

  const sessions = useMemo(() => plan?.sessions ?? [], [plan]);
  const tasks = useMemo(() => plan?.tasks ?? [], [plan]);
  const busySlots = useMemo(() => plan?.busySlots ?? [], [plan]);
  const warnings = useMemo(() => plan?.warnings ?? [], [plan]);

  const generation: DashboardGeneration = useMemo(
    () => ({
      planId: planId ?? "",
      sessions,
      tasks,
      busySlots,
      warnings
    }),
    [planId, sessions, tasks, busySlots, warnings]
  );

  const summary = useMemo(() => summarizeGeneratedPlan(generation), [generation]);
  const groupedSessions = useMemo(() => groupSessionsByDate(sessions), [sessions]);
  const groupedBusySlots = useMemo(
    () => groupBusySlotsByDate(busySlots),
    [busySlots]
  );
  const taskTitleById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task.title])),
    [tasks]
  );
  const todayD = new Date();
  const todayPad = (n: number) => String(n).padStart(2, "0");
  const today = `${todayD.getFullYear()}-${todayPad(todayD.getMonth() + 1)}-${todayPad(todayD.getDate())}`;

  // 计算当前周的周一（周一为一周的开始）
  const currentWeekMonday = useMemo(() => {
    const d = new Date(today);
    const day = d.getDay(); // 0=周日, 1=周一, ..., 6=周六
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }, [today]);

  // 初始化 weekOffset 为当前周相对于第一个 session 所在周的偏移
  useEffect(() => {
    if (!weekOffsetInitialized && groupedSessions.length > 0) {
      const firstDate = groupedSessions[0].date;
      const baseMonday = getMonday(firstDate);
      const diffDays = Math.round((currentWeekMonday.getTime() - baseMonday.getTime()) / (1000 * 60 * 60 * 24));
      const offset = Math.floor(diffDays / 7);
      setWeekOffset(offset);
      setWeekOffsetInitialized(true);
    }
  }, [groupedSessions, currentWeekMonday, weekOffsetInitialized]);

  const todaySessions = sessions.filter(
    (s) => {
      const d = new Date(s.startAt);
      return `${d.getFullYear()}-${todayPad(d.getMonth() + 1)}-${todayPad(d.getDate())}` === today;
    }
  );
  const todayBusySlots = busySlots.filter(
    (b) => {
      const d = new Date(b.startAt);
      return `${d.getFullYear()}-${todayPad(d.getMonth() + 1)}-${todayPad(d.getDate())}` === today;
    }
  );

  async function completeTask(taskId: string) {
    try {
      await markTaskCompleted(taskId);
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              tasks: prev.tasks.map((t) =>
                t.id === taskId ? { ...t, status: "completed" } : t
              ),
              progress: {
                ...prev.progress,
                completedTasks: prev.progress.completedTasks + 1
              }
            }
          : prev
      );
      setMessage("任务已标记完成。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    }
  }

  async function completeSession(sessionId: string) {
    try {
      await markSessionCompleted(sessionId);
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              sessions: prev.sessions.map((s) =>
                s.id === sessionId ? { ...s, status: "completed" } : s
              ),
              progress: {
                ...prev.progress,
                completedSessions: prev.progress.completedSessions + 1
              }
            }
          : prev
      );
      setMessage("日程已标记完成。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    }
  }

  async function handleReviewSubmit(payload: SessionReviewPayload) {
    if (!reviewSessionId) return;

    try {
      const result = await submitSessionReview(reviewSessionId, payload);
      setPlan((prev) =>
        prev
          ? {
              ...prev,
              sessions: [
                ...prev.sessions.map((s) =>
                  s.id === reviewSessionId
                    ? { ...s, status: "rescheduled" as const }
                    : s
                ),
                ...result.rescheduledSessions
              ],
              warnings: [...prev.warnings, ...result.warnings]
            }
          : prev
      );
      setMessage("复盘已提交，剩余任务已顺延。");
      setReviewSessionId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
    }
  }

  async function handleSyncCalendar() {
    if (!planId) return;
    setSyncing(true);
    setMessage("");
    try {
      const result = await syncToCalendar(planId);
      if (result.failedCount > 0) {
        setMessage(
          `同步完成：成功 ${result.syncedCount} 个，跳过 ${result.skippedCount} 个，失败 ${result.failedCount} 个`
        );
      } else if (result.syncedCount > 0) {
        setMessage(`已同步 ${result.syncedCount} 个日程到飞书日历。`);
      } else {
        setMessage("所有日程已同步，无需重复操作。");
      }
    } catch (error) {
      console.log("[sync-calendar] catch error:", error, "isFeishuAuthRequired:", isFeishuAuthRequired(error));
      if (isFeishuAuthRequired(error)) {
        // 弹出授权确认框
        setAuthDialogUrl(error.authorizeUrl);
        return;
      }
      setMessage(error instanceof Error ? error.message : "同步失败，请稍后重试。");
    } finally {
      setSyncing(false);
    }
  }

  if (viewState === "loading") {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (viewState === "error" || !plan) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-8 w-8 text-red-600" />
        <p className="text-sm text-red-700">{message || "计划未找到。"}</p>
        <button
          className="small-action"
          type="button"
          onClick={loadPlan}
        >
          重试
        </button>
      </div>
    );
  }

  if (!planId) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4">
        <AlertCircle className="h-8 w-8 text-red-600" />
        <p className="text-sm text-red-700">未指定计划。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 border-b border-border pb-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <CalendarClock className="h-4 w-4" />
          PlanFlow AI
        </div>
        <h1 className="text-2xl font-semibold">{plan.title}</h1>
        <p className="text-sm text-slate-600">{plan.goal}</p>
        <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
          <span>{formatDate(plan.startDate)} - {formatDate(plan.deadline)}</span>
          <span>共 {plan.totalMinutes} 分钟</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {statusLabel(plan.status)}
          </span>
        </div>
      </header>

      {message ? (
        <div className="rounded-md border border-border bg-white p-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="任务" value={`${plan.progress.completedTasks}/${plan.progress.totalTasks}`} />
        <Metric label="日程" value={`${plan.progress.completedSessions}/${plan.progress.totalSessions}`} />
        <Metric label="已排程" value={`${summary.scheduledMinutes} 分钟`} />
        <Metric label="忙闲时段" value={`${summary.busySlots}`} />
      </section>

      <div className="flex flex-wrap gap-2">
        <a
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-semibold text-slate-800 transition hover:border-primary"
          href={buildCalendarExportUrl(planId)}
        >
          <Download className="h-4 w-4" />
          导出 .ics
        </a>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-semibold text-slate-800 transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60"
          disabled={syncing}
          type="button"
          onClick={handleSyncCalendar}
        >
          {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {syncing ? "同步中..." : "同步到飞书日历"}
        </button>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-semibold text-slate-800 transition hover:border-primary"
          type="button"
          onClick={loadPlan}
        >
          <RotateCcw className="h-4 w-4" />
          刷新
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/[0.03] to-white">
        {/* 头部 */}
        <div className="flex items-center gap-3 border-b border-primary/10 bg-primary/[0.06] px-5 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">今日日程</h2>
            <p className="text-xs text-slate-500">
              {todaySessions.length + todayBusySlots.length === 0
                ? "今天暂无安排"
                : `${todaySessions.length} 个学习日程 · ${todayBusySlots.length} 个忙闲时段`}
            </p>
          </div>
        </div>

        {/* 内容 */}
        <div className="px-5 py-4">
          {todaySessions.length === 0 && todayBusySlots.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <CalendarClock className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500">今天没有日程或忙闲时段</p>
              <p className="text-xs text-slate-400">去创建计划开始学习吧</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {todaySessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  taskTitle={taskTitleById.get(session.taskId) ?? "学习日程"}
                  onComplete={() => completeSession(session.id)}
                  onReview={() => setReviewSessionId(session.id)}
                />
              ))}
              {todayBusySlots.map((slot) => (
                <BusySlotCard key={slot.id} slot={slot} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarClock className="h-5 w-5 text-primary" />
            周视图
          </h2>
          <div className="inline-flex rounded-md border border-border bg-white p-0.5">
            <button
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition ${
                weekViewMode === "list"
                  ? "bg-primary text-primaryForeground shadow-sm"
                  : "text-slate-600 hover:text-primary"
              }`}
              type="button"
              onClick={() => setWeekViewMode("list")}
            >
              <List className="h-3.5 w-3.5" />
              列表
            </button>
            <button
              className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition ${
                weekViewMode === "calendar"
                  ? "bg-primary text-primaryForeground shadow-sm"
                  : "text-slate-600 hover:text-primary"
              }`}
              type="button"
              onClick={() => setWeekViewMode("calendar")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              日历
            </button>
          </div>
        </div>

        {weekViewMode === "list" ? (
          <div className="flex flex-col gap-3">
            {groupedSessions.map((group) => (
              <div
                className={`rounded-md border p-3 ${group.date === today ? "border-primary bg-primary/5" : "border-border bg-white"}`}
                key={group.date}
              >
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  {formatDate(group.date)}
                  {group.date === today ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                      今天
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-col gap-2">
                  {group.sessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      taskTitle={taskTitleById.get(session.taskId) ?? "学习日程"}
                      onComplete={() => completeSession(session.id)}
                      onReview={() => setReviewSessionId(session.id)}
                    />
                  ))}
                  {groupedBusySlots
                    .filter((g) => g.date === group.date)
                    .flatMap((g) =>
                      g.slots.map((slot) => (
                        <BusySlotCard key={slot.id} slot={slot} />
                      ))
                    )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <WeekCalendarView
            groupedSessions={groupedSessions}
            groupedBusySlots={groupedBusySlots}
            today={today}
            taskTitleById={taskTitleById}
            weekOffset={weekOffset}
            onWeekChange={setWeekOffset}
            onReviewSession={(id) => setReviewSessionId(id)}
          />
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          任务列表
        </h2>
        {tasks.map((task) => (
          <div className="rounded-md border border-border bg-white p-3" key={task.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">{task.title}</div>
                <div className="mt-1 text-sm text-slate-600">
                  {task.estimatedMinutes} min
                  {task.phase ? ` - ${task.phase}` : ""}
                  {" - "}
                  <span className={task.status === "completed" ? "text-emerald-700" : "text-slate-500"}>
                    {taskStatusLabel(task.status ?? "not_started")}
                  </span>
                </div>
              </div>
              {task.status !== "completed" ? (
                <button
                  className="small-action"
                  type="button"
                  onClick={() => completeTask(task.id)}
                >
                  完成
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </section>

      {generation.warnings.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">警告</h2>
          {generation.warnings.map((warning, index) => (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              key={`${warning.code}-${warning.taskId ?? "plan"}-${index}`}
            >
              {warning.message}
            </div>
          ))}
        </section>
      ) : null}

      {reviewSessionId ? (
        <ReviewDialog
          sessionId={reviewSessionId}
          session={
            sessions.find((s) => s.id === reviewSessionId) ?? null
          }
          onClose={() => setReviewSessionId(null)}
          onSubmit={handleReviewSubmit}
        />
      ) : null}

      {authDialogUrl ? (
        <FeishuAuthDialog
          authorizeUrl={authDialogUrl}
          onClose={() => setAuthDialogUrl(null)}
        />
      ) : null}
    </div>
  );
}

// 将 ISO 时间字符串转为本地整点标签
function toLocalHourLabel(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:00`;
}

// 计算 session 跨越的小时数
function getSessionHourSpan(startAt: string, endAt: string): number {
  const diffMs = new Date(endAt).getTime() - new Date(startAt).getTime();
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60)));
}

// 获取某日期所在周的周一
function getMonday(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

// 生成连续小时时间槽
function generateHourSlots(startHour: number, endHour: number): string[] {
  const slots: string[] = [];
  for (let h = startHour; h <= endHour; h++) {
    slots.push(`${String(h).padStart(2, "0")}:00`);
  }
  return slots;
}

const WEEKDAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function WeekCalendarView({
  groupedSessions,
  groupedBusySlots,
  today,
  taskTitleById,
  weekOffset,
  onWeekChange,
  onReviewSession
}: {
  groupedSessions: { date: string; sessions: DashboardSession[] }[];
  groupedBusySlots: { date: string; slots: DashboardBusySlot[] }[];
  today: string;
  taskTitleById: Map<string, string>;
  weekOffset: number;
  onWeekChange: (offset: number) => void;
  onReviewSession: (id: string) => void;
}) {
  // 根据 weekOffset 计算当前周的周一，生成 7 天
  const weekDates = useMemo(() => {
    if (groupedSessions.length === 0) return [];
    const firstDate = groupedSessions[0].date;
    const baseMonday = getMonday(firstDate);
    // 根据偏移量计算目标周的周一
    const targetMonday = new Date(baseMonday);
    targetMonday.setDate(baseMonday.getDate() + weekOffset * 7);
    // 生成 7 天（周一到周日）
    const dates: string[] = [];
    const pad = (n: number) => String(n).padStart(2, "0");
    for (let i = 0; i < 7; i++) {
      const d = new Date(targetMonday);
      d.setDate(targetMonday.getDate() + i);
      dates.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
    }
    return dates;
  }, [groupedSessions, weekOffset]);

  // 动态计算时间范围，覆盖所有 session
  const timeSlots = useMemo(() => {
    if (groupedSessions.length === 0) return generateHourSlots(8, 22);
    let minHour = 24;
    let maxHour = 0;
    for (const group of groupedSessions) {
      for (const session of group.sessions) {
        const hour = new Date(session.startAt).getHours();
        if (hour < minHour) minHour = hour;
        if (hour > maxHour) maxHour = hour;
      }
    }
    // 确保至少覆盖 08:00-22:00
    minHour = Math.min(minHour, 8);
    maxHour = Math.max(maxHour, 22);
    return generateHourSlots(minHour, maxHour);
  }, [groupedSessions]);

  // 按日期+小时分组 sessions
  const sessionsByDateAndHour = useMemo(() => {
    const map = new Map<string, Map<string, DashboardSession[]>>();
    for (const group of groupedSessions) {
      for (const session of group.sessions) {
        const hour = toLocalHourLabel(session.startAt);
        if (!map.has(group.date)) map.set(group.date, new Map());
        const dateMap = map.get(group.date)!;
        if (!dateMap.has(hour)) dateMap.set(hour, []);
        dateMap.get(hour)!.push(session);
      }
    }
    return map;
  }, [groupedSessions]);

  // 按日期+小时分组 busySlots
  const busySlotsByDateAndHour = useMemo(() => {
    const map = new Map<string, Map<string, DashboardBusySlot[]>>();
    for (const group of groupedBusySlots) {
      for (const slot of group.slots) {
        const hour = toLocalHourLabel(slot.startAt);
        if (!map.has(group.date)) map.set(group.date, new Map());
        const dateMap = map.get(group.date)!;
        if (!dateMap.has(hour)) dateMap.set(hour, []);
        dateMap.get(hour)!.push(slot);
      }
    }
    return map;
  }, [groupedBusySlots]);

  if (weekDates.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-white p-8 text-center text-sm text-slate-500">
        暂无日程数据
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-white">
      <div className="min-w-[700px]">
        {/* 周导航栏 */}
        <div className="flex items-center justify-between border-b border-border bg-slate-50 px-3 py-2">
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-xs font-medium text-slate-700 transition hover:border-primary hover:text-primary"
            type="button"
            onClick={() => onWeekChange(weekOffset - 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            上一周
          </button>
          <span className="text-sm font-semibold text-slate-800">
            {weekDates.length > 0 && (() => {
              const first = new Date(weekDates[0]);
              const last = new Date(weekDates[6]);
              const fmt = (d: Date) => `${d.getMonth() + 1}月${d.getDate()}日`;
              return `${fmt(first)} - ${fmt(last)}`;
            })()}
          </span>
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-white px-3 text-xs font-medium text-slate-700 transition hover:border-primary hover:text-primary"
            type="button"
            onClick={() => onWeekChange(weekOffset + 1)}
          >
            下一周
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* 表头 */}
        <div className="grid grid-cols-8 border-b border-border bg-slate-50 text-xs font-semibold text-slate-600">
          <div className="border-r border-border p-2 text-center">时间</div>
          {weekDates.map((date) => {
            const d = new Date(date);
            const dayName = WEEKDAY_NAMES[d.getDay()];
            const month = d.getMonth() + 1;
            const day = d.getDate();
            const isToday = date === today;
            return (
              <div
                key={date}
                className={`border-r border-border p-2 text-center last:border-r-0 ${
                  isToday ? "bg-primary/5 text-primary" : ""
                }`}
              >
                <div>{dayName}</div>
                <div className="text-[10px] text-slate-500">{month}/{day}</div>
              </div>
            );
          })}
        </div>

        {/* 时间行 */}
        {timeSlots.map((time) => (
          <div
            key={time}
            className="grid grid-cols-8 border-b border-slate-100 last:border-b-0"
            style={{ minHeight: "60px" }}
          >
            <div className="border-r border-border bg-slate-50/50 p-2 text-center text-xs text-slate-500">
              {time}
            </div>
            {weekDates.map((date) => {
              const hourSessions = sessionsByDateAndHour.get(date)?.get(time) ?? [];
              const hourBusySlots = busySlotsByDateAndHour.get(date)?.get(time) ?? [];
              return (
                <div
                  key={`${date}-${time}`}
                  className="relative border-r border-slate-100 last:border-r-0"
                >
                  {/* 学习日程 */}
                  {hourSessions.map((session) => {
                    const hourSpan = getSessionHourSpan(session.startAt, session.endAt);
                    const taskTitle = taskTitleById.get(session.taskId) ?? "学习日程";
                    const isCompleted = session.status === "completed";
                    const isRescheduled = session.status === "rescheduled";
                    return (
                      <div
                        key={session.id}
                        className={`absolute inset-x-1 cursor-pointer rounded px-2 py-1 text-xs ${
                          isCompleted
                            ? "bg-emerald-100 text-emerald-700"
                            : isRescheduled
                              ? "bg-amber-100 text-amber-700"
                              : "bg-primary/10 text-primary"
                        }`}
                        style={{
                          top: "2px",
                          height: `calc(${hourSpan} * 60px - 4px)`,
                          zIndex: 10
                        }}
                        onClick={() => {
                          if (session.status === "scheduled") {
                            onReviewSession(session.id);
                          }
                        }}
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
                  {/* 忙闲时段 */}
                  {hourBusySlots.map((slot) => {
                    const hourSpan = getSessionHourSpan(slot.startAt, slot.endAt);
                    return (
                      <div
                        key={slot.id}
                        className="absolute inset-x-1 rounded bg-red-100/80 px-2 py-1 text-xs text-red-700"
                        style={{
                          top: "2px",
                          height: `calc(${hourSpan} * 60px - 4px)`,
                          zIndex: 5
                        }}
                        title={`${slot.title}`}
                      >
                        <div className="font-medium truncate">{slot.title}</div>
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
  const isActive = session.status === "scheduled";

  return (
    <div
      className={`rounded-lg p-3 text-sm transition-shadow ${
        isCompleted
          ? "border border-emerald-200 bg-emerald-50/70 text-emerald-800"
          : isRescheduled
            ? "border border-amber-200 bg-amber-50/70 text-amber-800"
            : "border border-primary/20 bg-primary/[0.04] shadow-sm hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className={`font-semibold ${isActive ? "text-slate-900" : ""}`}>
            {taskTitle}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                isCompleted
                  ? "bg-emerald-100 text-emerald-700"
                  : isRescheduled
                    ? "bg-amber-100 text-amber-700"
                    : "bg-primary/10 text-primary"
              }`}
            >
              <Clock className="h-3 w-3" />
              {formatTime(session.startAt)} - {formatTime(session.endAt)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                isCompleted
                  ? "bg-emerald-100 text-emerald-700"
                  : isRescheduled
                    ? "bg-amber-100 text-amber-700"
                    : "bg-primary/15 text-primary"
              }`}
            >
              {sessionStatusLabel(session.status)}
            </span>
          </div>
        </div>
      </div>
      {isActive ? (
        <div className="mt-3 flex gap-2 border-t border-primary/10 pt-2.5">
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primaryForeground shadow-sm transition hover:bg-teal-800"
            type="button"
            onClick={onComplete}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            完成
          </button>
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:border-primary hover:text-primary"
            type="button"
            onClick={onReview}
          >
            复盘
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BusySlotCard({ slot }: { slot: DashboardBusySlot }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 text-sm">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-100">
          <AlertCircle className="h-4 w-4 text-red-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-red-800">{slot.title}</div>
          <div className="mt-0.5 text-xs text-red-600">
            {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="text-xs font-medium uppercase text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function ReviewDialog({
  sessionId,
  session,
  onClose,
  onSubmit
}: {
  sessionId: string;
  session: DashboardSession | null;
  onSubmit: (payload: SessionReviewPayload) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<SessionReviewPayload["result"]>("partial");
  const [actualMinutes, setActualMinutes] = useState(
    Math.floor((session?.durationMinutes ?? 60) / 2)
  );
  const [remainingMinutes, setRemainingMinutes] = useState(
    Math.ceil((session?.durationMinutes ?? 60) / 2)
  );
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await onSubmit({
        result,
        actualMinutes,
        remainingMinutes: result === "completed" ? 0 : remainingMinutes,
        reason: reason || undefined,
        continueTask: result !== "completed" && result !== "skipped"
      });
    } finally {
      setSubmitting(false);
    }
  }

  const durationMinutes = session?.durationMinutes ?? 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">日程复盘</h3>
          <button
            className="rounded-md p-1 text-slate-500 transition hover:text-slate-800"
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          日程：{sessionId}（已排 {durationMinutes} 分钟）
        </p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">完成情况</span>
            <select
              className="input"
              value={result}
              onChange={(e) =>
                setResult(e.target.value as SessionReviewPayload["result"])
              }
            >
              <option value="completed">已完成</option>
              <option value="partial">部分完成</option>
              <option value="not_completed">未完成</option>
              <option value="skipped">跳过</option>
            </select>
          </label>
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
          <div className="flex justify-end gap-2">
            <button
              className="small-action"
              type="button"
              onClick={onClose}
            >
              取消
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primaryForeground transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              提交复盘
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FeishuAuthDialog({
  authorizeUrl,
  onClose
}: {
  authorizeUrl: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-sm rounded-lg border border-border bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
            <Upload className="h-5 w-5 text-white" />
          </div>
          <h3 className="text-lg font-semibold">同步到飞书日历</h3>
        </div>
        <p className="mb-5 text-sm text-slate-600">
          同步日程需要授权你的飞书账号。点击确认后将跳转到飞书登录页面，授权完成后自动返回。
        </p>
        <div className="flex justify-end gap-2">
          <button
            className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            type="button"
            onClick={onClose}
          >
            取消
          </button>
          <a
            className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primaryForeground transition hover:bg-teal-800"
            href={authorizeUrl}
          >
            确认授权
          </a>
        </div>
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "草稿",
    generated: "已生成",
    archived: "已归档"
  };
  return labels[status] ?? status;
}

function taskStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    not_started: "未开始",
    in_progress: "进行中",
    completed: "已完成",
    delayed: "已延期"
  };
  return labels[status] ?? status;
}

function sessionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    scheduled: "已排程",
    completed: "已完成",
    missed: "已错过",
    rescheduled: "已顺延",
    conflicted: "冲突"
  };
  return labels[status] ?? status;
}
