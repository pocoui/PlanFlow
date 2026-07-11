import { describe, expect, it } from "vitest";

import {
  buildCalendarExportUrl,
  groupSessionsByDate,
  markSessionCompleted,
  markTaskCompleted,
  submitSessionReview,
  summarizeGeneratedPlan
} from "./planDashboard";
import type { DashboardGeneration } from "./planDashboard";

describe("planDashboard", () => {
  it("summarizes generated plan progress", () => {
    const summary = summarizeGeneratedPlan(generation());

    expect(summary).toEqual({
      totalTasks: 2,
      totalSessions: 2,
      scheduledMinutes: 150,
      busySlots: 1,
      warnings: 0,
      progressPercent: 0,
      completedHours: 0
    });
  });

  it("groups sessions by calendar date", () => {
    const grouped = groupSessionsByDate(generation().sessions);

    expect(grouped).toEqual([
      {
        date: "2026-07-06",
        sessions: [generation().sessions[0]]
      },
      {
        date: "2026-07-08",
        sessions: [generation().sessions[1]]
      }
    ]);
  });

  it("marks a task completed through the status API", async () => {
    const calls: Array<{ url: string | URL; init?: RequestInit }> = [];
    const fetcher = async (url: string | URL, init?: RequestInit) => {
      calls.push({ url, init });
      return jsonResponse({ id: "task_1", status: "completed" });
    };

    const result = await markTaskCompleted("task_1", fetcher);

    expect(result.status).toBe("completed");
    expect(String(calls[0].url)).toBe("/api/tasks/task_1/status");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      status: "completed"
    });
  });

  it("marks a session completed through the status API", async () => {
    const fetcher = async () =>
      jsonResponse({ id: "session_1", status: "completed" });

    const result = await markSessionCompleted("session_1", fetcher);

    expect(result.status).toBe("completed");
  });

  it("submits a session review through the review API", async () => {
    const calls: Array<{ url: string | URL; init?: RequestInit }> = [];
    const fetcher = async (url: string | URL, init?: RequestInit) => {
      calls.push({ url, init });
      return jsonResponse({
        reviewId: "review_1",
        sessionId: "session_1",
        taskId: "task_1",
        rescheduledSessions: [],
        warnings: []
      });
    };

    const result = await submitSessionReview(
      "session_1",
      {
        result: "partial",
        actualMinutes: 30,
        remainingMinutes: 30,
        reason: "Interrupted",
        continueTask: true
      },
      fetcher
    );

    expect(result.reviewId).toBe("review_1");
    expect(String(calls[0].url)).toBe("/api/sessions/session_1/review");
  });

  it("builds the ICS export URL", () => {
    expect(buildCalendarExportUrl("plan_1")).toBe("/api/plans/plan_1/calendar.ics");
  });
});

function generation(): DashboardGeneration {
  return {
    planId: "plan_1",
    tasks: [
      {
        id: "task_1",
        title: "React basics",
        estimatedMinutes: 90,
        status: "not_started"
      },
      {
        id: "task_2",
        title: "Hooks practice",
        estimatedMinutes: 60,
        status: "not_started"
      }
    ],
    sessions: [
      {
        id: "session_1",
        taskId: "task_1",
        startAt: "2026-07-06T09:00:00.000Z",
        endAt: "2026-07-06T10:30:00.000Z",
        durationMinutes: 90,
        status: "scheduled",
        hasReview: false
      },
      {
        id: "session_2",
        taskId: "task_2",
        startAt: "2026-07-08T09:00:00.000Z",
        endAt: "2026-07-08T10:00:00.000Z",
        durationMinutes: 60,
        status: "scheduled",
        hasReview: false
      }
    ],
    busySlots: [
      {
        id: "busy_1",
        title: "Meeting",
        startAt: "2026-07-06T11:00:00.000Z",
        endAt: "2026-07-06T12:00:00.000Z"
      }
    ],
    warnings: []
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
