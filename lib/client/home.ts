import { fetchPlanDashboard } from "./planDashboard";
import type { DashboardPlan, DashboardSession } from "./planDashboard";

export interface HomeData {
  hasPlans: boolean;
  partialFailure?: boolean;
  plans: HomePlanSummary[];
  todaySessions: HomeTodaySession[];
  pendingAlerts: HomeAlert[];
}

export interface HomePlanSummary {
  id: string;
  title: string;
  status: "draft" | "generated" | "archived";
  totalMinutes: number;
  completedMinutes: number;
  progressPercent: number;
  nextSession: {
    id: string;
    taskTitle: string;
    startAt: string;
    endAt: string;
    isInProgress: boolean;
  } | null;
}

export interface HomeTodaySession {
  id: string;
  planId: string;
  planTitle: string;
  taskId: string;
  taskTitle: string;
  startAt: string;
  endAt: string;
  status: "scheduled" | "conflicted";
}

export interface HomeAlert {
  type: "review" | "feishu_auth" | "conflict";
  message: string;
  actionLabel: string;
  planId: string;
  sessionId?: string;
  action: {
    kind: "href" | "authorize";
    payload?: string;
  };
}

export function aggregateHomeData(
  plans: DashboardPlan[],
  options: { now?: Date; partialFailure?: boolean } = {}
): HomeData {
  const now = options.now ?? new Date();
  const generatedPlans = plans
    .filter((plan) => plan.status === "generated")
    .sort((a, b) => sortByCreatedAtDesc(a, b));

  if (generatedPlans.length === 0) {
    return {
      hasPlans: plans.length > 0,
      partialFailure: options.partialFailure,
      plans: [],
      todaySessions: [],
      pendingAlerts: []
    };
  }

  const summaries: HomePlanSummary[] = [];
  const todaySessions: HomeTodaySession[] = [];
  const pendingAlerts: HomeAlert[] = [];

  for (const plan of generatedPlans) {
    const taskById = new Map(plan.tasks.map((task) => [task.id, task]));
    const completedMinutes = plan.sessions
      .filter((session) => session.status === "completed")
      .reduce((total, session) => total + getSessionMinutes(session), 0);
    const progressPercent =
      plan.totalMinutes > 0
        ? Math.min(100, Math.round((completedMinutes / plan.totalMinutes) * 100))
        : 0;

    const nextSession = findNextSession(plan, taskById, now);

    summaries.push({
      id: plan.id,
      title: plan.title,
      status: plan.status as "draft" | "generated" | "archived",
      totalMinutes: plan.totalMinutes,
      completedMinutes,
      progressPercent,
      nextSession
    });

    const todayKey = formatLocalDate(now);
    for (const session of plan.sessions) {
      if (formatLocalDate(session.startAt) !== todayKey) continue;
      if (session.status !== "scheduled" && session.status !== "conflicted") continue;

      const task = taskById.get(session.taskId);
      todaySessions.push({
        id: session.id,
        planId: plan.id,
        planTitle: plan.title,
        taskId: session.taskId,
        taskTitle: task?.title ?? "学习日程",
        startAt: session.startAt,
        endAt: session.endAt,
        status: session.status as "scheduled" | "conflicted"
      });
    }

    for (const session of plan.sessions) {
      if (session.status !== "completed" || session.hasReview) continue;

      const task = taskById.get(session.taskId);
      pendingAlerts.push({
        type: "review",
        message: `「${task?.title ?? "学习日程"}」已完成，记得复盘哦`,
        actionLabel: "去复盘",
        planId: plan.id,
        sessionId: session.id,
        action: {
          kind: "href",
          payload: `/dashboard?planId=${plan.id}&reviewSessionId=${session.id}`
        }
      });
    }
  }

  todaySessions.sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  return {
    hasPlans: true,
    partialFailure: options.partialFailure,
    plans: summaries,
    todaySessions,
    pendingAlerts
  };
}

export function getTodaySessionStatus(
  session: Pick<DashboardSession, "startAt" | "endAt" | "status">,
  now: Date
): string {
  if (session.status === "conflicted") return "冲突";

  const startAt = new Date(session.startAt).getTime();
  const endAt = new Date(session.endAt).getTime();

  if (now.getTime() < startAt) return "未开始";
  if (now.getTime() > endAt) return "已结束";
  return "进行中";
}

function findNextSession(
  plan: DashboardPlan,
  taskById: Map<string, DashboardPlan["tasks"][number]>,
  now: Date
): HomePlanSummary["nextSession"] {
  const eligible = plan.sessions
    .filter(
      (session) =>
        (session.status === "scheduled" || session.status === "conflicted") &&
        new Date(session.endAt).getTime() > now.getTime()
    )
    .sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );

  const inProgress = eligible.find((session) => {
    const startAt = new Date(session.startAt).getTime();
    return startAt <= now.getTime();
  });

  const session = inProgress ?? eligible[0];
  if (!session) return null;

  const task = taskById.get(session.taskId);
  return {
    id: session.id,
    taskTitle: task?.title ?? "学习日程",
    startAt: session.startAt,
    endAt: session.endAt,
    isInProgress: inProgress === session
  };
}

function getSessionMinutes(session: DashboardSession): number {
  if (typeof session.durationMinutes === "number") {
    return session.durationMinutes;
  }

  return Math.max(
    0,
    Math.round(
      (new Date(session.endAt).getTime() - new Date(session.startAt).getTime()) / 60000
    )
  );
}

export interface FetchHomeDataOptions {
  retryPlanIds?: string[];
  existingPlans?: DashboardPlan[];
}

export async function fetchHomeData(
  options: FetchHomeDataOptions = {}
): Promise<HomeData & { failedPlanIds: string[]; fetchedPlans: DashboardPlan[] }> {
  const listResponse = await fetch("/api/plans");
  if (!listResponse.ok) {
    throw new Error("加载计划列表失败");
  }
  const plans = (await listResponse.json()) as Array<{ id: string; status: string }>;

  if (plans.length === 0) {
    return {
      hasPlans: false,
      failedPlanIds: [],
      fetchedPlans: [],
      plans: [],
      todaySessions: [],
      pendingAlerts: []
    };
  }

  const generatedPlans = plans.filter((p) => p.status === "generated");
  const plansToFetch = options.retryPlanIds
    ? generatedPlans.filter((p) => options.retryPlanIds!.includes(p.id))
    : generatedPlans;

  const detailResults = await Promise.allSettled(
    plansToFetch.map((p) => fetchPlanDashboard(p.id))
  );

  const fulfilledPlans = detailResults
    .map((r) => (r.status === "fulfilled" ? r.value : null))
    .filter((p): p is DashboardPlan => p !== null);

  const failedPlanIds = plansToFetch
    .map((p, index) => (detailResults[index].status === "rejected" ? p.id : null))
    .filter((id): id is string => id !== null);

  // 重试时合并已有的成功计划数据，避免覆盖
  const existingPlans = options.existingPlans?.filter(
    (p) => !failedPlanIds.includes(p.id)
  );
  const allPlans = [...(existingPlans ?? []), ...fulfilledPlans];

  const homeData = aggregateHomeData(allPlans, {
    partialFailure: failedPlanIds.length > 0
  });

  return { ...homeData, failedPlanIds, fetchedPlans: allPlans };
}

function formatLocalDate(value: string | Date): string {
  const d = value instanceof Date ? value : new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function sortByCreatedAtDesc(a: DashboardPlan, b: DashboardPlan): number {
  const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  return bTime - aTime;
}
