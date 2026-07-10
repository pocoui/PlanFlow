import { describe, expect, it } from "vitest";

import { aggregateHomeData, type HomeAlert } from "../home";
import type { DashboardPlan, DashboardSession } from "../planDashboard";

function createPlan(overrides: Partial<DashboardPlan> = {}): DashboardPlan {
  return {
    id: "plan_1",
    title: "学习 React",
    goal: "掌握 React 基础",
    totalMinutes: 120,
    startDate: "2026-07-01",
    deadline: "2026-07-31",
    status: "generated",
    tasks: [
      {
        id: "task_1",
        title: "JSX 基础",
        estimatedMinutes: 60,
        status: "not_started"
      },
      {
        id: "task_2",
        title: "Hooks",
        estimatedMinutes: 60,
        status: "completed"
      }
    ],
    sessions: [],
    busySlots: [],
    warnings: [],
    progress: {
      totalTasks: 2,
      completedTasks: 1,
      totalSessions: 0,
      completedSessions: 0
    },
    ...overrides
  };
}

function createSession(overrides: Partial<DashboardSession> = {}): DashboardSession {
  return {
    id: "session_1",
    taskId: "task_1",
    startAt: "2026-07-10T09:00:00.000Z",
    endAt: "2026-07-10T10:00:00.000Z",
    durationMinutes: 60,
    status: "scheduled",
    hasReview: false,
    ...overrides
  };
}

describe("aggregateHomeData", () => {
  it("returns empty state when no plans", () => {
    const result = aggregateHomeData([]);

    expect(result.hasPlans).toBe(false);
    expect(result.plans).toEqual([]);
    expect(result.todaySessions).toEqual([]);
    expect(result.pendingAlerts).toEqual([]);
  });

  it("only includes generated plans", () => {
    const draft = createPlan({ id: "plan_draft", status: "draft" });
    const generated = createPlan({ id: "plan_generated", status: "generated" });
    const archived = createPlan({ id: "plan_archived", status: "archived" });

    const result = aggregateHomeData([draft, generated, archived]);

    expect(result.hasPlans).toBe(true);
    expect(result.plans).toHaveLength(1);
    expect(result.plans[0].id).toBe("plan_generated");
  });

  it("filters today sessions by local date", () => {
    const today = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const todayStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T09:00:00.000Z`;
    const todayEnd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}T10:00:00.000Z`;
    const tomorrowStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate() + 1)}T09:00:00.000Z`;

    const plan = createPlan({
      sessions: [
        createSession({ id: "s1", startAt: todayStart, endAt: todayEnd }),
        createSession({ id: "s2", startAt: tomorrowStart, endAt: tomorrowStart })
      ]
    });

    const result = aggregateHomeData([plan]);

    expect(result.todaySessions).toHaveLength(1);
    expect(result.todaySessions[0].id).toBe("s1");
  });

  it("calculates progress by completed minutes", () => {
    const plan = createPlan({
      totalMinutes: 120,
      sessions: [
        createSession({ id: "s1", status: "completed", durationMinutes: 30 }),
        createSession({ id: "s2", status: "scheduled", durationMinutes: 60 })
      ]
    });

    const result = aggregateHomeData([plan]);

    expect(result.plans[0].completedMinutes).toBe(30);
    expect(result.plans[0].progressPercent).toBe(25);
  });

  it("returns review alerts for completed sessions without review", () => {
    const plan = createPlan({
      sessions: [
        createSession({ id: "s1", status: "completed", hasReview: false, taskId: "task_1" }),
        createSession({ id: "s2", status: "completed", hasReview: true, taskId: "task_1" })
      ]
    });

    const result = aggregateHomeData([plan]);

    expect(result.pendingAlerts).toHaveLength(1);
    expect(result.pendingAlerts[0].type).toBe("review");
    expect((result.pendingAlerts[0] as HomeAlert).sessionId).toBe("s1");
  });

  it("handles totalMinutes=0 without NaN", () => {
    const plan = createPlan({ totalMinutes: 0 });

    const result = aggregateHomeData([plan]);

    expect(result.plans[0].progressPercent).toBe(0);
  });

  it("picks the earliest upcoming session as nextSession", () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    const futureStart = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T09:00:00.000Z`;

    const plan = createPlan({
      sessions: [
        createSession({ id: "s1", startAt: futureStart, endAt: futureStart, taskId: "task_1" })
      ]
    });

    const result = aggregateHomeData([plan]);

    expect(result.plans[0].nextSession).not.toBeNull();
    expect(result.plans[0].nextSession?.id).toBe("s1");
    expect(result.plans[0].nextSession?.taskTitle).toBe("JSX 基础");
  });
});
