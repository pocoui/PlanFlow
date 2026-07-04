import { describe, expect, it } from "vitest";

import {
  createInMemoryPlanRepository,
  createPlan,
  generatePlan,
  getPlan
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
});

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
