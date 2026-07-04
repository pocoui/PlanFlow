import { describe, expect, it } from "vitest";

import {
  exportPlanCalendarIcs,
  createInMemoryPlanRepository,
  createPlan,
  generatePlan,
  getBusySlotsForPlan,
  getPlan,
  submitSessionReview,
  updateSessionStatus,
  updateTaskStatus
} from "../planService";

describe("planService", () => {
  it("creates a draft plan with valid availability", async () => {
    const repository = createInMemoryPlanRepository();

    const plan = await createPlan(validCreatePlanInput(), { repository });

    expect(plan).toMatchObject({
      title: "学习 React",
      status: "draft"
    });
    expect(plan.availability).toHaveLength(2);
  });

  it("rejects invalid create plan input", async () => {
    const repository = createInMemoryPlanRepository();

    await expect(
      createPlan(
        validCreatePlanInput({
          deadline: "2026-07-01"
        }),
        { repository }
      )
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    });
  });

  it("rejects overlapping availability when creating a plan", async () => {
    const repository = createInMemoryPlanRepository();

    await expect(
      createPlan(
        validCreatePlanInput({
          availability: [
            { weekday: 1, startTime: "09:00", endTime: "11:00" },
            { weekday: 1, startTime: "10:30", endTime: "12:00" }
          ]
        }),
        { repository }
      )
    ).rejects.toMatchObject({
      code: "VALIDATION_ERROR"
    });
  });

  it("generates tasks, busy slots, and sessions for an existing plan", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createPlan(
      validCreatePlanInput({
        totalMinutes: 120,
        startDate: "2026-07-06",
        deadline: "2026-07-07",
        availability: [{ weekday: 1, startTime: "09:00", endTime: "12:00" }]
      }),
      { repository }
    );

    const result = await generatePlan(plan.id, { repository });

    expect(result.planId).toBe(plan.id);
    expect(result.tasks).toHaveLength(3);
    expect(result.busySlots.length).toBeGreaterThan(0);
    expect(result.sessions.length).toBeGreaterThan(0);
    expect(result.sessions.every((session) => session.status === "scheduled")).toBe(
      true
    );
  });

  it("returns plan details with availability, tasks, sessions, and progress", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createPlan(
      validCreatePlanInput({
        totalMinutes: 120,
        startDate: "2026-07-06",
        deadline: "2026-07-07",
        availability: [{ weekday: 1, startTime: "09:00", endTime: "12:00" }]
      }),
      { repository }
    );
    await generatePlan(plan.id, { repository });

    const details = await getPlan(plan.id, { repository });

    expect(details.id).toBe(plan.id);
    expect(details.availability).toHaveLength(1);
    expect(details.tasks).toHaveLength(3);
    expect(details.sessions.length).toBeGreaterThan(0);
    expect(details.progress.totalTasks).toBe(3);
  });

  it("updates task and session statuses", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createGeneratedPlan(repository);
    const taskId = plan.tasks[0].id;
    const sessionId = plan.sessions[0].id;

    const task = await updateTaskStatus(taskId, "completed", { repository });
    const session = await updateSessionStatus(sessionId, "completed", {
      repository
    });
    const details = await getPlan(plan.id, { repository });

    expect(task.status).toBe("completed");
    expect(session.status).toBe("completed");
    expect(details.progress.completedTasks).toBe(1);
    expect(details.progress.completedSessions).toBe(1);
  });

  it("rejects invalid task and session statuses", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createGeneratedPlan(repository);

    await expect(
      updateTaskStatus(plan.tasks[0].id, "done", { repository })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      updateSessionStatus(plan.sessions[0].id, "done", { repository })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("submits a partial session review and creates rescheduled sessions", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createGeneratedPlan(repository);
    const session = plan.sessions[0];

    const result = await submitSessionReview(
      session.id,
      {
        result: "partial",
        actualMinutes: 20,
        remainingMinutes: 30,
        reason: "Interrupted by a meeting",
        continueTask: true
      },
      { repository }
    );
    const details = await getPlan(plan.id, { repository });

    expect(result.sessionId).toBe(session.id);
    expect(result.taskId).toBe(session.taskId);
    expect(result.rescheduledSessions.length).toBeGreaterThan(0);
    expect(result.rescheduledSessions[0]).toMatchObject({
      taskId: session.taskId,
      status: "scheduled"
    });
    expect(
      result.rescheduledSessions.reduce(
        (total, item) => total + item.durationMinutes,
        0
      )
    ).toBe(30);
    expect(details.sessions.find((item) => item.id === session.id)?.status).toBe(
      "rescheduled"
    );
  });

  it("returns busy slots for a plan date range", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createPlan(
      validCreatePlanInput({
        startDate: "2026-07-06",
        deadline: "2026-07-09"
      }),
      { repository }
    );

    const result = await getBusySlotsForPlan(
      plan.id,
      {
        start: "2026-07-06",
        end: "2026-07-09"
      },
      { repository }
    );

    expect(result.provider).toBe("mock_feishu");
    expect(result.busySlots.map((slot) => slot.id)).toContain(
      "mock-feishu-weekly-standup"
    );
  });

  it("exports scheduled sessions as an ICS calendar", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createGeneratedPlan(repository);

    const ics = await exportPlanCalendarIcs(plan.id, { repository });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:");
    expect(ics).toContain("DESCRIPTION:");
  });

  it("rejects ICS export when a plan has no scheduled sessions", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createPlan(validCreatePlanInput(), { repository });

    await expect(exportPlanCalendarIcs(plan.id, { repository })).rejects.toMatchObject({
      code: "CONFLICT"
    });
  });
});

async function createGeneratedPlan(
  repository: ReturnType<typeof createInMemoryPlanRepository>
) {
  const plan = await createPlan(
    validCreatePlanInput({
      totalMinutes: 120,
      startDate: "2026-07-06",
      deadline: "2026-07-09",
      availability: [
        { weekday: 1, startTime: "09:00", endTime: "12:00" },
        { weekday: 3, startTime: "09:00", endTime: "12:00" }
      ]
    }),
    { repository }
  );
  await generatePlan(plan.id, { repository });

  return getPlan(plan.id, { repository });
}

function validCreatePlanInput(
  overrides: Partial<Parameters<typeof createPlan>[0]> = {}
): Parameters<typeof createPlan>[0] {
  return {
    title: "学习 React",
    goal: "学习 React 基础、Hooks、路由，并完成一个小项目。",
    totalMinutes: 180,
    startDate: "2026-07-03",
    deadline: "2026-07-20",
    rescheduleBufferMinutes: 15,
    availability: [
      { weekday: 1, startTime: "20:00", endTime: "22:00" },
      { weekday: 6, startTime: "09:00", endTime: "12:00" }
    ],
    ...overrides
  };
}
