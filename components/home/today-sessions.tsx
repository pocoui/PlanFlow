"use client";

import { AlertCircle, CalendarClock, CheckCircle2, Clock, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { HomeTodayBusySlot, HomeTodaySession } from "@/lib/client/home";
import { getTodaySessionStatus } from "@/lib/client/home";

export interface TodaySessionsProps {
  sessions: HomeTodaySession[];
  busySlots?: HomeTodayBusySlot[];
  onComplete?: (sessionId: string, planId: string) => Promise<void>;
  onReview?: (sessionId: string, planId: string) => void;
}

export function TodaySessions({ sessions, busySlots = [], onComplete, onReview }: TodaySessionsProps) {
  const now = new Date();
  const totalItems = sessions.length + busySlots.length;

  return (
    <section className="overflow-hidden rounded-xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-primary/[0.03] to-white">
      {/* 头部 */}
      <div className="flex items-center gap-3 border-b border-primary/10 bg-primary/[0.06] px-5 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">今日日程</h2>
          <p className="text-xs text-slate-500">
            {totalItems === 0
              ? "今天暂无安排"
              : `${sessions.length} 个学习日程 · ${busySlots.length} 个忙闲时段`}
          </p>
        </div>
      </div>

      {/* 内容 */}
      <div className="px-5 py-4">
        {sessions.length === 0 && busySlots.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <CalendarClock className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">今天没有日程或忙闲时段</p>
            <p className="text-xs text-slate-400">去创建计划开始学习吧</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {sessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                now={now}
                onComplete={onComplete}
                onReview={onReview}
              />
            ))}
            {busySlots.map((slot) => (
              <BusySlotRow key={slot.id} slot={slot} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SessionRow({
  session,
  now,
  onComplete,
  onReview
}: {
  session: HomeTodaySession;
  now: Date;
  onComplete?: (sessionId: string, planId: string) => Promise<void>;
  onReview?: (sessionId: string, planId: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = getTodaySessionStatus(session, now);

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
    <div className="flex flex-col gap-2 rounded-lg border border-primary/20 bg-primary/[0.04] p-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-slate-900">{session.taskTitle}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
            <span
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary"
            >
              <Clock className="h-3 w-3" />
              {formatTime(session.startAt)} - {formatTime(session.endAt)}
            </span>
            <span className="text-slate-500">{session.planTitle}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                status === "进行中"
                  ? "bg-emerald-100 text-emerald-700"
                  : status === "冲突"
                    ? "bg-amber-100 text-amber-700"
                    : status === "已完成"
                      ? "bg-teal-100 text-teal-700"
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
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700 transition hover:bg-amber-100"
              href={`/dashboard?planId=${encodeURIComponent(session.planId)}`}
            >
              查看冲突
            </Link>
          ) : session.status === "completed" ? (
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary transition hover:bg-primary/20"
              type="button"
              onClick={() => onReview?.(session.id, session.planId)}
            >
              复盘
            </button>
          ) : (
            <button
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-semibold text-primaryForeground shadow-sm transition hover:bg-teal-800 disabled:opacity-60"
              disabled={loading}
              type="button"
              onClick={handleComplete}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              完成
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

function BusySlotRow({ slot }: { slot: HomeTodayBusySlot }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50/70 p-3">
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

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
