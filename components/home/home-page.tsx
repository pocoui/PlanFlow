"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { fetchHomeData, type HomeData } from "@/lib/client/home";
import { markSessionStatus, type DashboardPlan } from "@/lib/client/planDashboard";

import { EmptyHome } from "./empty-home";
import { ErrorCard } from "./error-card";
import { Greeting } from "./greeting";
import { HomeSkeleton } from "./home-skeleton";
import { PendingAlerts } from "./pending-alerts";
import { PlanProgressCard } from "./plan-progress-card";
import { QuickActions } from "./quick-actions";
import { TodaySessions } from "./today-sessions";

type HomePageState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      data: HomeData;
      failedPlanIds: string[];
      planDetails: DashboardPlan[];
    };

export function HomePage() {
  const router = useRouter();
  const [state, setState] = useState<HomePageState>({ status: "loading" });

  const load = useCallback(
    async (options: { retryPlanIds?: string[]; existingPlans?: DashboardPlan[] } = {}) => {
      setState((prev) => ({ ...prev, status: "loading" }));

      try {
        const result = await fetchHomeData({
          retryPlanIds: options.retryPlanIds,
          existingPlans: options.existingPlans
        });
        const { failedPlanIds, fetchedPlans, ...homeData } = result;

        setState({
          status: "ready",
          data: homeData,
          failedPlanIds,
          planDetails: fetchedPlans
        });
      } catch (error) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "加载首页数据失败。"
        });
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRetry() {
    if (state.status !== "ready" || state.failedPlanIds.length === 0) {
      void load();
      return;
    }

    setState((prev) => ({ ...prev, status: "loading" }));
    try {
      const result = await fetchHomeData({
        retryPlanIds: state.failedPlanIds,
        existingPlans: state.planDetails
      });
      const { failedPlanIds, fetchedPlans, ...homeData } = result;

      setState({
        status: "ready",
        data: homeData,
        failedPlanIds,
        planDetails: fetchedPlans
      });
    } catch (error) {
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "加载首页数据失败。"
      });
    }
  }

  async function handleComplete(sessionId: string, planId: string) {
    await markSessionStatus(sessionId, "completed");
    router.push(`/dashboard?planId=${encodeURIComponent(planId)}&reviewSessionId=${encodeURIComponent(sessionId)}`);
  }

  const { exportPlanId, exportDisabled } = useMemo(() => {
    if (state.status !== "ready") {
      return { exportPlanId: undefined, exportDisabled: true };
    }

    const firstPlan = state.planDetails[0];
    if (!firstPlan) {
      return { exportPlanId: undefined, exportDisabled: true };
    }

    const hasExportableSessions = firstPlan.sessions.some(
      (session) => session.status === "scheduled" || session.status === "completed"
    );

    return {
      exportPlanId: firstPlan.id,
      exportDisabled: !hasExportableSessions
    };
  }, [state]);

  if (state.status === "loading") {
    return (
      <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <HomeSkeleton />
        </div>
      </main>
    );
  }

  if (state.status === "error") {
    return (
      <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <ErrorCard message={state.message} onRetry={handleRetry} />
        </div>
      </main>
    );
  }

  const { data } = state;

  if (!data.hasPlans) {
    return (
      <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto w-full max-w-3xl">
          <Greeting />
          <div className="mt-8">
            <EmptyHome />
          </div>
          <div className="mt-8">
            <QuickActions hasPlans={false} />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <Greeting todaySessionCount={data.todaySessions.length} />

        <QuickActions
          hasPlans
          exportPlanId={exportPlanId}
          exportDisabled={exportDisabled}
        />

        {data.partialFailure ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            部分计划加载失败。
            <button
              className="ml-2 font-semibold underline hover:text-amber-900"
              type="button"
              onClick={handleRetry}
            >
              重试
            </button>
          </div>
        ) : null}

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">进行中的计划</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {data.plans.map((plan) => (
              <PlanProgressCard key={plan.id} plan={plan} />
            ))}
          </div>
        </section>

        <TodaySessions
          sessions={data.todaySessions}
          busySlots={data.todayBusySlots}
          onComplete={handleComplete}
        />

        <PendingAlerts alerts={data.pendingAlerts} />
      </div>
    </main>
  );
}
