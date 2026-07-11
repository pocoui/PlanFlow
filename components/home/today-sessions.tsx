"use client";

import { CalendarClock, CheckCircle2, Loader2, SkipForward } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { HomeTodaySession } from "@/lib/client/home";
import { getTodaySessionStatus } from "@/lib/client/home";

export interface TodaySessionsProps {
  sessions: HomeTodaySession[];
  onSkip?: (sessionId: string) => Promise<void>;
  onComplete?: (sessionId: string, planId: string) => Promise<void>;
}

const MAX_DISPLAY = 3;

export function TodaySessions({ sessions, onSkip, onComplete }: TodaySessionsProps) {
  const now = new Date();
  const displaySessions = sessions.slice(0, MAX_DISPLAY);
  const remaining = Math.max(0, sessions.length - MAX_DISPLAY);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarClock className="h-5 w-5 text-primary" />
          今日学习
        </h2>
        <span className="text-xs text-slate-500">{sessions.length} 个日程</span>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
          今天没有安排学习任务，好好休息或提前开启明天的学习。
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {displaySessions.map((session) => (
            <SessionRow
              key={session.id}
              session={session}
              now={now}
              onSkip={onSkip}
              onComplete={onComplete}
            />
          ))}
          {remaining > 0 ? (
            <Link
              className="text-center text-sm font-medium text-primary hover:underline"
              href="/dashboard"
            >
              还有 {remaining} 个日程
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}

function SessionRow({
  session,
  now,
  onSkip,
  onComplete
}: {
  session: HomeTodaySession;
  now: Date;
  onSkip?: (sessionId: string) => Promise<void>;
  onComplete?: (sessionId: string, planId: string) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = getTodaySessionStatus(session, now);

  async function handleSkip() {
    if (!onSkip || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onSkip(session.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    if (!onComplete || loading) return;
    setLoading(true);
    setError(null);
    try {
      await onComplete(session.id, session.planId);
    } catch (err) {
      setLoading(false);
      setError(err instanceof Error ? err.message : "操作失败，请重试");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-900">{session.taskTitle}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              {formatTime(session.startAt)} - {formatTime(session.endAt)}
            </span>
            <span className="text-slate-300">·</span>
            <span>{session.planTitle}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                status === "进行中"
                  ? "bg-emerald-100 text-emerald-700"
                  : status === "冲突"
                    ? "bg-amber-100 text-amber-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {status}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {session.status === "conflicted" ? (
            <Link
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
              href={`/dashboard?planId=${encodeURIComponent(session.planId)}`}
            >
              查看冲突
            </Link>
          ) : status === "进行中" ? (
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primaryForeground shadow-sm transition hover:bg-teal-800 disabled:opacity-60"
              disabled={loading}
              type="button"
              onClick={handleComplete}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              标记完成
            </button>
          ) : (
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition hover:border-primary hover:text-primary disabled:opacity-60"
              disabled={loading}
              type="button"
              onClick={handleSkip}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <SkipForward className="h-3.5 w-3.5" />
              )}
              跳过
            </button>
          )}
        </div>
      </div>

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
    </div>
  );
}

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
