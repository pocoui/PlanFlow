"use client";

import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  RotateCcw,
  Sparkles,
  X
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import {
  buildCalendarExportUrl,
  fetchPlanDashboard,
  groupSessionsByDate,
  markSessionCompleted,
  markTaskCompleted,
  submitSessionReview,
  summarizeGeneratedPlan
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
      const date = slot.startAt.slice(0, 10);
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
  planId: string;
}

type ViewState = "loading" | "ready" | "error";

export function PlanDashboard({ planId }: PlanDashboardProps) {
  const [viewState, setViewState] = useState<ViewState>("loading");
  const [plan, setPlan] = useState<DashboardPlan | null>(null);
  const [message, setMessage] = useState("");
  const [reviewSessionId, setReviewSessionId] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setViewState("loading");
    setMessage("");

    try {
      const result = await fetchPlanDashboard(planId);
      setPlan(result);
      setViewState("ready");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load plan.");
      setViewState("error");
    }
  }, [planId]);

  if (viewState === "loading" && !plan) {
    void loadPlan();
  }

  const sessions = useMemo(() => plan?.sessions ?? [], [plan]);
  const tasks = useMemo(() => plan?.tasks ?? [], [plan]);
  const busySlots = useMemo(() => plan?.busySlots ?? [], [plan]);
  const warnings = useMemo(() => plan?.warnings ?? [], [plan]);

  const generation: DashboardGeneration = useMemo(
    () => ({
      planId,
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
  const today = new Date().toISOString().slice(0, 10);

  const todaySessions = sessions.filter(
    (s) => s.startAt.slice(0, 10) === today
  );
  const todayBusySlots = busySlots.filter(
    (b) => b.startAt.slice(0, 10) === today
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
      setMessage("Task marked completed.");
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
      setMessage("Session marked completed.");
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
      setMessage("Review submitted and remaining work rescheduled.");
      setReviewSessionId(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Request failed.");
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
        <p className="text-sm text-red-700">{message || "Plan not found."}</p>
        <button
          className="small-action"
          type="button"
          onClick={loadPlan}
        >
          Retry
        </button>
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
          <span>{plan.totalMinutes} min total</span>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {plan.status}
          </span>
        </div>
      </header>

      {message ? (
        <div className="rounded-md border border-border bg-white p-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Tasks" value={`${plan.progress.completedTasks}/${plan.progress.totalTasks}`} />
        <Metric label="Sessions" value={`${plan.progress.completedSessions}/${plan.progress.totalSessions}`} />
        <Metric label="Scheduled" value={`${summary.scheduledMinutes} min`} />
        <Metric label="Busy slots" value={`${summary.busySlots}`} />
      </section>

      <div className="flex flex-wrap gap-2">
        <a
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-semibold text-slate-800 transition hover:border-primary"
          href={buildCalendarExportUrl(planId)}
        >
          <Download className="h-4 w-4" />
          Export .ics
        </a>
        <button
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-semibold text-slate-800 transition hover:border-primary"
          type="button"
          onClick={loadPlan}
        >
          <RotateCcw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Sparkles className="h-5 w-5 text-primary" />
          Today&apos;s schedule
        </h2>
        {todaySessions.length === 0 && todayBusySlots.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-white p-4 text-sm text-slate-500">
            No sessions or busy slots today.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {todaySessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                taskTitle={taskTitleById.get(session.taskId) ?? "Learning session"}
                onComplete={() => completeSession(session.id)}
                onReview={() => setReviewSessionId(session.id)}
              />
            ))}
            {todayBusySlots.map((slot) => (
              <BusySlotCard key={slot.id} slot={slot} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarClock className="h-5 w-5 text-primary" />
          Week calendar
        </h2>
        {groupedSessions.map((group) => (
          <div
            className={`rounded-md border p-3 ${group.date === today ? "border-primary bg-primary/5" : "border-border bg-white"}`}
            key={group.date}
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
              {formatDate(group.date)}
              {group.date === today ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">
                  Today
                </span>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              {group.sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  taskTitle={taskTitleById.get(session.taskId) ?? "Learning session"}
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
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Task list
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
                    {task.status ?? "not_started"}
                  </span>
                </div>
              </div>
              {task.status !== "completed" ? (
                <button
                  className="small-action"
                  type="button"
                  onClick={() => completeTask(task.id)}
                >
                  Complete
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </section>

      {generation.warnings.length > 0 ? (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Warnings</h2>
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

  return (
    <div
      className={`rounded-md p-2 text-sm ${
        isCompleted
          ? "bg-emerald-50 text-emerald-800"
          : isRescheduled
            ? "bg-amber-50 text-amber-800"
            : "bg-slate-50 text-slate-700"
      }`}
    >
      <div className="font-medium">{taskTitle}</div>
      <div className="mt-1 flex items-center gap-2">
        <Clock className="h-3 w-3" />
        {formatTime(session.startAt)} - {formatTime(session.endAt)}
        <span
          className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
            isCompleted
              ? "bg-emerald-100 text-emerald-700"
              : isRescheduled
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-100 text-slate-600"
          }`}
        >
          {session.status}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {session.status === "scheduled" ? (
          <>
            <button className="small-action" type="button" onClick={onComplete}>
              Complete
            </button>
            <button className="small-action" type="button" onClick={onReview}>
              Review
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function BusySlotCard({ slot }: { slot: DashboardBusySlot }) {
  return (
    <div className="rounded-md bg-red-50 p-2 text-sm text-red-800">
      <div className="font-medium">{slot.title}</div>
      <div className="mt-1 flex items-center gap-2">
        <Clock className="h-3 w-3" />
        {formatTime(slot.startAt)} - {formatTime(slot.endAt)}
        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700">
          busy
        </span>
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
          <h3 className="text-lg font-semibold">Session Review</h3>
          <button
            className="rounded-md p-1 text-slate-500 transition hover:text-slate-800"
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-slate-600">
          Session: {sessionId} ({durationMinutes} min scheduled)
        </p>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">Result</span>
            <select
              className="input"
              value={result}
              onChange={(e) =>
                setResult(e.target.value as SessionReviewPayload["result"])
              }
            >
              <option value="completed">Completed</option>
              <option value="partial">Partial</option>
              <option value="not_completed">Not completed</option>
              <option value="skipped">Skipped</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-700">
              Actual minutes
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
                Remaining minutes
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
              Reason (optional)
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
              Cancel
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primaryForeground transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit review
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium"
  }).format(new Date(value));
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en", {
    timeStyle: "short"
  }).format(new Date(value));
}
