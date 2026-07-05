"use client";

import { CalendarDays, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { PlanDashboard } from "@/components/plan-dashboard";

interface PlanSummary {
  id: string;
  title: string;
  goal: string;
  status: string;
  createdAt: string;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const planIdFromUrl = searchParams.get("planId");
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(!planIdFromUrl);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    planIdFromUrl
  );

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/plans");
      if (!response.ok) throw new Error("Failed to load plans");
      const data = (await response.json()) as PlanSummary[];
      setPlans(data);
      // 自动选择第一个已生成的计划，否则选第一个
      if (!planIdFromUrl && data.length > 0) {
        const generated = data.find((p) => p.status === "generated");
        setSelectedPlanId(generated?.id ?? data[0].id);
      }
    } catch {
      // 获取计划列表失败，保持空状态
    } finally {
      setLoading(false);
    }
  }, [planIdFromUrl]);

  useEffect(() => {
    if (!planIdFromUrl) {
      void loadPlans();
    }
  }, [planIdFromUrl, loadPlans]);

  // URL 传入 planId 优先
  const activePlanId = planIdFromUrl ?? selectedPlanId;

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!activePlanId) {
    return (
      <main className="flex min-h-[400px] flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <CalendarDays className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">暂无学习计划</h2>
        <p className="max-w-sm text-sm text-slate-500">
          请先创建学习计划并生成排程，即可在此查看日历看板与进度。
        </p>
        <Link
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primaryForeground shadow-sm transition hover:bg-teal-800"
          href="/plans/new"
        >
          <Plus className="h-4 w-4" />
          创建学习计划
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-3xl">
        {plans.length > 1 && !planIdFromUrl ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-slate-600">切换计划：</span>
            {plans.map((plan) => (
              <button
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  plan.id === activePlanId
                    ? "bg-primary text-primaryForeground"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
                key={plan.id}
                type="button"
                onClick={() => setSelectedPlanId(plan.id)}
              >
                {plan.title || plan.goal.slice(0, 20)}
              </button>
            ))}
          </div>
        ) : null}
        <PlanDashboard planId={activePlanId} />
      </div>
    </main>
  );
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardContent />
    </Suspense>
  );
}
