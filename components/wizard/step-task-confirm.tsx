"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { generatePlanTasks, type GeneratedTask } from "@/lib/client/planCreation";

import type { PlanInfo } from "./wizard-types";

export function StepTaskConfirm({
  planId,
  planInfo,
  tasks,
  loading,
  onTasksLoaded,
  onSchedule
}: {
  planId: string | null;
  planInfo: PlanInfo;
  tasks: GeneratedTask[] | null;
  loading: boolean;
  onTasksLoaded: (tasks: GeneratedTask[]) => void;
  onSchedule: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const totalHours = Number(planInfo.totalHours) || 0;

  useEffect(() => {
    if (!planId || tasks) return;

    let cancelled = false;
    setError(null);

    generatePlanTasks(planId)
      .then((result) => {
        if (!cancelled) onTasksLoaded(result.tasks);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "任务拆解失败");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [planId, tasks, onTasksLoaded]);

  const groupedByPhase = useMemo(() => {
    const groups = new Map<string, GeneratedTask[]>();

    for (const task of tasks ?? []) {
      const phase = task.phase || "其他";
      const list = groups.get(phase) ?? [];
      list.push(task);
      groups.set(phase, list);
    }

    return Array.from(groups.entries());
  }, [tasks]);

  if (!tasks) {
    return (
      <section className="flex flex-col items-center justify-center gap-4 py-16 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>AI 正在拆解学习任务...</p>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <div className="rounded-lg border border-slate-100 bg-slate-50/50 p-4 text-sm text-slate-600">
        <div className="flex flex-wrap gap-4">
          <span>
            总计：<strong className="text-slate-900">{totalHours} 小时</strong>
          </span>
          <span>
            日期：
            <strong className="text-slate-900">
              {planInfo.startDate || "—"} 至 {planInfo.deadline || "—"}
            </strong>
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">阶段</th>
              <th className="px-4 py-3 text-left">任务</th>
              <th className="px-4 py-3 text-left">预计时长</th>
              <th className="px-4 py-3 text-left">验收标准</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {groupedByPhase.map(([phase, phaseTasks]) =>
              phaseTasks.map((task, index) => (
                <tr key={task.id} className="bg-white hover:bg-slate-50/50">
                  {index === 0 ? (
                    <td
                      className="border-r border-slate-100 bg-slate-50 px-4 py-3 align-top font-semibold text-slate-700"
                      rowSpan={phaseTasks.length}
                    >
                      {phase}
                    </td>
                  ) : null}
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {task.title}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {Math.round(task.estimatedMinutes / 6) / 10} 小时
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {task.acceptanceCriteria && task.acceptanceCriteria.length > 0
                      ? task.acceptanceCriteria.join("；")
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <button
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-6 text-sm font-semibold text-primaryForeground shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading || tasks.length === 0}
          type="button"
          onClick={onSchedule}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          生成排程
        </button>
      </div>
    </section>
  );
}
