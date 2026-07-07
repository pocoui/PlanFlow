"use client";

import { Clock, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { DashboardGeneration, DashboardSession, SessionReviewPayload } from "@/lib/client/planDashboard";

import { formatDate, formatTime } from "./wizard-utils";

export function StepReview({
  generation,
  onReview
}: {
  generation: DashboardGeneration;
  onReview: (sessionId: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const todaySessions = generation.sessions.filter(
    (s) => s.startAt.slice(0, 10) === today
  );
  const completedCount = generation.sessions.filter(
    (s) => s.status === "completed"
  ).length;
  const progress =
    generation.sessions.length > 0
      ? Math.round((completedCount / generation.sessions.length) * 100)
      : 0;

  return (
    <section className="flex flex-col gap-5 lg:flex-row">
      <div className="flex flex-1 flex-col gap-5">
        <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-sm text-slate-600">
          回顾今日学习情况，对未完成或部分完成的日程进行复盘和重新排程。
        </div>

        <div className="flex items-center gap-5 rounded-lg border border-slate-200 bg-white p-5">
          <div className="relative h-20 w-20">
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
                strokeDasharray={`${progress}, 100`}
                strokeWidth="3"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-base font-bold">
              {progress}%
            </span>
          </div>
          <div>
            <div className="text-base font-bold text-slate-900">总进度</div>
            <div className="text-sm text-slate-600">
              已完成 {completedCount} / {generation.sessions.length} 个日程
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-800">今日日程</h3>
          {todaySessions.length === 0 ? (
            <p className="text-sm text-slate-500">今天没有学习日程。</p>
          ) : (
            <div className="flex flex-col gap-2">
              {todaySessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-md border border-slate-100 bg-slate-50 p-3"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-800">
                      {formatTime(session.startAt)} -{" "}
                      {formatTime(session.endAt)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {session.status === "completed" ? "已完成" : "待复盘"}
                    </div>
                  </div>
                  {session.status !== "completed" ? (
                    <button
                      className="small-action"
                      type="button"
                      onClick={() => onReview(session.id)}
                    >
                      复盘
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-full rounded-lg border border-slate-200 bg-white p-4 lg:w-80">
        <h3 className="mb-4 text-sm font-bold text-slate-800">进度细分</h3>
        <div className="space-y-4">
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
    </section>
  );
}

export function SessionCard({
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
      className={`rounded-md p-3 text-sm ${
        isCompleted
          ? "bg-emerald-50 text-emerald-800"
          : isRescheduled
            ? "bg-amber-50 text-amber-800"
            : "bg-slate-50 text-slate-700"
      }`}
    >
      <div className="font-medium">{taskTitle}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        <Clock className="h-3 w-3" />
        {formatTime(session.startAt)} - {formatTime(session.endAt)}
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
            isCompleted
              ? "bg-emerald-100 text-emerald-700"
              : isRescheduled
                ? "bg-amber-100 text-amber-700"
                : "bg-slate-200 text-slate-600"
          }`}
        >
          {session.status}
        </span>
      </div>
      {session.status === "scheduled" ? (
        <div className="mt-2 flex gap-2">
          <button className="small-action" type="button" onClick={onComplete}>
            完成
          </button>
          <button className="small-action" type="button" onClick={onReview}>
            复盘
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ReviewDialog({
  session,
  taskTitle,
  onClose,
  onSubmit
}: {
  session: DashboardSession | null;
  taskTitle: string;
  onSubmit: (
    payload: SessionReviewPayload,
    action: "reschedule" | "skip" | "custom"
  ) => void;
  onClose: () => void;
}) {
  const [result, setResult] = useState<SessionReviewPayload["result"]>(
    "not_completed"
  );
  const [actualMinutes, setActualMinutes] = useState(
    Math.floor((session?.durationMinutes ?? 60) / 2)
  );
  const [remainingMinutes, setRemainingMinutes] = useState(
    Math.ceil((session?.durationMinutes ?? 60) / 2)
  );
  const [reason, setReason] = useState("临时有事，时间不足");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (result === "completed") {
      setActualMinutes(session?.durationMinutes ?? 60);
      setRemainingMinutes(0);
    }
  }, [result, session?.durationMinutes]);

  async function handleSubmit(action: "reschedule" | "skip" | "custom") {
    setSubmitting(true);

    try {
      await onSubmit(
        {
          result,
          actualMinutes,
          remainingMinutes: result === "completed" ? 0 : remainingMinutes,
          reason: reason || undefined,
          continueTask: result !== "completed" && result !== "skipped"
        },
        action
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">复盘本次学习任务</h3>
          <button
            className="rounded-md p-1 text-slate-500 transition hover:text-slate-800"
            type="button"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="font-medium text-slate-800">{taskTitle}</div>
          <div className="mt-1 text-slate-600">
            {session ? formatDate(session.startAt) : "—"} ·{" "}
            {session
              ? `${formatTime(session.startAt)} - ${formatTime(session.endAt)}`
              : "—"}
          </div>
        </div>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit("reschedule");
          }}
        >
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700">完成情况</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "completed", label: "已完成" },
                { value: "partial", label: "部分完成" },
                { value: "not_completed", label: "未完成" },
                { value: "skipped", label: "跳过" }
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                    result === option.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-slate-200 text-slate-700 hover:border-primary"
                  }`}
                >
                  <input
                    checked={result === option.value}
                    className="h-4 w-4 accent-primary"
                    name="review-result"
                    type="radio"
                    value={option.value}
                    onChange={(e) =>
                      setResult(e.target.value as SessionReviewPayload["result"])
                    }
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

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

          <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
            <div className="text-xs text-slate-500">顺延建议（AI 计算）</div>
            <div className="mt-1 text-sm font-medium text-slate-800">
              顺延到最近的可用时间段
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              className="small-action"
              disabled={submitting}
              type="button"
              onClick={() => handleSubmit("skip")}
            >
              不顺延
            </button>
            <button
              className="small-action"
              disabled={submitting}
              type="button"
              onClick={() => handleSubmit("custom")}
            >
              顺延到其他时间
            </button>
            <button
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primaryForeground transition hover:bg-teal-800 disabled:opacity-60"
              disabled={submitting}
              type="submit"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              确认顺延
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
