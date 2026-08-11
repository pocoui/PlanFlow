import { describe, expect, it, vi } from "vitest";

import type { CalendarProvider } from "@/lib/calendar/calendarProvider";

import {
  exportPlanCalendarIcs,
  createInMemoryPlanRepository,
  createPlan,
  deletePlan,
  generatePlan,
  generatePlanTasks,
  schedulePlan,
  getBusySlotsForPlan,
  getPlan,
  submitSessionReview,
  syncSessionsToCalendar,
  updateSessionStatus,
  updateTaskStatus
} from "../planService";

/** 测试用计划归属用户（与 repository.createPlan 的 userId: "u1" 保持一致） */
const USER_ID = "u1";

describe("planService", () => {
  it("creates a draft plan with valid availability", async () => {
    const repository = createInMemoryPlanRepository();

    const plan = await createPlan(validCreatePlanInput(), { repository, userId: USER_ID });

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
        { repository, userId: USER_ID }
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
        { repository, userId: USER_ID }
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
      { repository, userId: USER_ID }
    );

    const result = await generatePlan(plan.id, { repository, userId: USER_ID });

    expect(result.planId).toBe(plan.id);
    expect(result.tasks).toHaveLength(9);
    expect(result.busySlots.length).toBeGreaterThanOrEqual(0);
    expect(result.sessions.length).toBeGreaterThan(0);
    expect(result.sessions.every((session) => session.status === "scheduled")).toBe(
      true
    );
  });

  it("generates tasks without scheduling", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createPlan(
      validCreatePlanInput({
        totalMinutes: 120,
        startDate: "2026-07-06",
        deadline: "2026-07-07",
        availability: [{ weekday: 1, startTime: "09:00", endTime: "12:00" }]
      }),
      { repository, userId: USER_ID }
    );

    const result = await generatePlanTasks(plan.id, { repository, userId: USER_ID });

    expect(result.planId).toBe(plan.id);
    expect(result.tasks).toHaveLength(9);

    const stored = await getPlan(plan.id, { repository, userId: USER_ID });
    expect(stored.tasks).toHaveLength(9);
    expect(stored.sessions).toHaveLength(0);
    expect(stored.busySlots).toHaveLength(0);
  });

  it("schedules existing tasks into sessions", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createPlan(
      validCreatePlanInput({
        totalMinutes: 120,
        startDate: "2026-07-06",
        deadline: "2026-07-07",
        availability: [{ weekday: 1, startTime: "09:00", endTime: "12:00" }]
      }),
      { repository, userId: USER_ID }
    );
    await generatePlanTasks(plan.id, { repository, userId: USER_ID });

    const result = await schedulePlan(plan.id, { repository, userId: USER_ID });

    expect(result.planId).toBe(plan.id);
    expect(result.tasks).toHaveLength(9);
    expect(result.sessions.length).toBeGreaterThan(0);
    expect(result.sessions.every((session) => session.status === "scheduled")).toBe(
      true
    );
  });

  it("rejects scheduling when plan has no tasks", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createPlan(
      validCreatePlanInput({
        totalMinutes: 120,
        startDate: "2026-07-06",
        deadline: "2026-07-07",
        availability: [{ weekday: 1, startTime: "09:00", endTime: "12:00" }]
      }),
      { repository, userId: USER_ID }
    );

    await expect(schedulePlan(plan.id, { repository, userId: USER_ID })).rejects.toMatchObject({
      code: "CONFLICT"
    });
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
      { repository, userId: USER_ID }
    );
    await generatePlan(plan.id, { repository, userId: USER_ID });

    const details = await getPlan(plan.id, { repository, userId: USER_ID });

    expect(details.id).toBe(plan.id);
    expect(details.availability).toHaveLength(1);
    expect(details.tasks).toHaveLength(9);
    expect(details.sessions.length).toBeGreaterThan(0);
    expect(details.progress.totalTasks).toBe(9);
  });

  it("updates task and session statuses", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createGeneratedPlan(repository);
    const taskId = plan.tasks[0].id;
    const sessionId = plan.sessions[0].id;

    const task = await updateTaskStatus(taskId, "completed", { repository, userId: USER_ID });
    const session = await updateSessionStatus(sessionId, "completed", {
      repository,
      userId: USER_ID
    });
    const details = await getPlan(plan.id, { repository, userId: USER_ID });

    expect(task.status).toBe("completed");
    expect(session.status).toBe("completed");
    expect(details.progress.completedTasks).toBe(1);
    expect(details.progress.completedSessions).toBe(1);
  });

  it("rejects invalid task and session statuses", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createGeneratedPlan(repository);

    await expect(
      updateTaskStatus(plan.tasks[0].id, "done", { repository, userId: USER_ID })
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await expect(
      updateSessionStatus(plan.sessions[0].id, "done", { repository, userId: USER_ID })
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
      { repository, userId: USER_ID }
    );
    const details = await getPlan(plan.id, { repository, userId: USER_ID });

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

  it("returns hasReview=false for completed session without review", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createGeneratedPlan(repository);
    const session = plan.sessions[0];

    await updateSessionStatus(session.id, "completed", { repository, userId: USER_ID });
    const details = await getPlan(plan.id, { repository, userId: USER_ID });
    const updated = details.sessions.find((item) => item.id === session.id);

    expect(updated).toBeDefined();
    expect(updated!.hasReview).toBe(false);
  });

  it("returns hasReview=true for completed session with review", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createGeneratedPlan(repository);
    const session = plan.sessions[0];

    await updateSessionStatus(session.id, "completed", { repository, userId: USER_ID });
    await submitSessionReview(
      session.id,
      {
        result: "completed",
        actualMinutes: session.durationMinutes,
        remainingMinutes: 0,
        reason: "",
        continueTask: false
      },
      { repository, userId: USER_ID }
    );
    const details = await getPlan(plan.id, { repository, userId: USER_ID });
    const updated = details.sessions.find((item) => item.id === session.id);

    expect(updated).toBeDefined();
    expect(updated!.hasReview).toBe(true);
  });

  it("returns busy slots for a plan date range", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createPlan(
      validCreatePlanInput({
        startDate: "2026-07-06",
        deadline: "2026-07-09"
      }),
      { repository, userId: USER_ID }
    );

    const result = await getBusySlotsForPlan(
      plan.id,
      {
        start: "2026-07-06",
        end: "2026-07-09"
      },
      { repository, userId: USER_ID }
    );

    expect(result.provider).toBe("mock_feishu");
    // TODO: busySlots 逻辑暂不实现，后续对接真实日历 API 后再恢复断言
    expect(Array.isArray(result.busySlots)).toBe(true);
  });

  it("exports scheduled sessions as an ICS calendar", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createGeneratedPlan(repository);

    const ics = await exportPlanCalendarIcs(plan.id, { repository, userId: USER_ID });

    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("SUMMARY:");
    expect(ics).toContain("DESCRIPTION:");
  });

  it("rejects ICS export when a plan has no scheduled sessions", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createPlan(validCreatePlanInput(), { repository, userId: USER_ID });

    await expect(exportPlanCalendarIcs(plan.id, { repository, userId: USER_ID })).rejects.toMatchObject({
      code: "CONFLICT"
    });
  });

  it("isolates plans by owner: another user cannot read or delete the plan", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createPlan(validCreatePlanInput(), { repository, userId: USER_ID });

    // 其他用户不可见（返回 NOT_FOUND，不泄露存在性）
    await expect(getPlan(plan.id, { repository, userId: "u2" })).rejects.toMatchObject({
      code: "NOT_FOUND"
    });
    await expect(deletePlan(plan.id, { repository, userId: "u2" })).rejects.toMatchObject({
      code: "NOT_FOUND"
    });

    // 本人可正常访问
    const details = await getPlan(plan.id, { repository, userId: USER_ID });
    expect(details.id).toBe(plan.id);
  });

  it("isolates all cross-user operations: every read/mutating path returns NOT_FOUND", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await createGeneratedPlan(repository);
    const taskId = plan.tasks[0].id;
    const sessionId = plan.sessions[0].id;

    // 计划级操作：他人一律 NOT_FOUND（不泄露存在性）
    await expect(generatePlan(plan.id, { repository, userId: "u2" })).rejects.toMatchObject({
      code: "NOT_FOUND"
    });
    await expect(generatePlanTasks(plan.id, { repository, userId: "u2" })).rejects.toMatchObject({
      code: "NOT_FOUND"
    });
    await expect(schedulePlan(plan.id, { repository, userId: "u2" })).rejects.toMatchObject({
      code: "NOT_FOUND"
    });
    await expect(getBusySlotsForPlan(
      plan.id,
      { start: "2026-07-06", end: "2026-07-09" },
      { repository, userId: "u2" }
    )).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(exportPlanCalendarIcs(plan.id, { repository, userId: "u2" })).rejects.toMatchObject({
      code: "NOT_FOUND"
    });
    await expect(syncSessionsToCalendar(plan.id, { repository, userId: "u2" })).rejects.toMatchObject({
      code: "NOT_FOUND"
    });

    // 任务/会话级操作：经 task/session 反查计划归属，他人一律 NOT_FOUND
    await expect(
      updateTaskStatus(taskId, "completed", { repository, userId: "u2" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      updateSessionStatus(sessionId, "completed", { repository, userId: "u2" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      submitSessionReview(
        sessionId,
        {
          result: "completed",
          actualMinutes: plan.sessions[0].durationMinutes,
          remainingMinutes: 0,
          reason: "",
          continueTask: false
        },
        { repository, userId: "u2" }
      )
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
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
    { repository, userId: USER_ID }
  );
  await generatePlan(plan.id, { repository, userId: USER_ID });

  return getPlan(plan.id, { repository, userId: USER_ID });
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

describe("syncSessionsToCalendar", () => {
  it("应将所有未同步的 session 同步到日历", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await repository.createPlan({
      userId: "u1",
      title: "测试计划",
      goal: "测试",
      totalMinutes: 120,
      startDate: new Date("2026-07-06"),
      deadline: new Date("2026-07-12"),
      rescheduleBufferMinutes: 15,
      status: "draft",
      availability: [
        { weekday: 1, startTime: "09:00", endTime: "11:00" }
      ]
    });

    // 添加 tasks 和 sessions
    await repository.savePlanGeneration({
      planId: plan.id,
      tasks: [
        {
          id: "task1",
          phase: "phase1",
          title: "学习任务1",
          description: "描述",
          estimatedMinutes: 60,
          priority: 1,
          acceptanceCriteria: ["完成练习"],
          orderIndex: 0
        }
      ],
      sessions: [
        {
          taskId: "task1",
          startAt: new Date("2026-07-06T09:00:00.000Z"),
          endAt: new Date("2026-07-06T10:00:00.000Z"),
          durationMinutes: 60,
          status: "scheduled" as const
        }
      ],
      busySlots: [],
      warnings: []
    });

    // mock calendarProvider
    const mockCalendarProvider = {
      getBusySlots: vi.fn().mockResolvedValue([]),
      createCalendarEvent: vi.fn().mockResolvedValue({
        externalEventId: "feishu_evt_001",
        title: "学习任务1",
        description: "完成练习",
        startAt: new Date("2026-07-06T09:00:00.000Z"),
        endAt: new Date("2026-07-06T10:00:00.000Z")
      }),
      updateCalendarEvent: vi.fn().mockResolvedValue({}),
      deleteCalendarEvent: vi.fn().mockResolvedValue(undefined)
    };

    const result = await syncSessionsToCalendar(plan.id, {
      repository,
      calendarProvider: mockCalendarProvider as unknown as CalendarProvider,
      userId: USER_ID
    });

    expect(result.syncedCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(mockCalendarProvider.createCalendarEvent).toHaveBeenCalledTimes(1);
  });

  it("已同步的 session 应跳过不重复创建", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await repository.createPlan({
      userId: "u1",
      title: "测试计划",
      goal: "测试",
      totalMinutes: 120,
      startDate: new Date("2026-07-06"),
      deadline: new Date("2026-07-12"),
      rescheduleBufferMinutes: 15,
      status: "draft",
      availability: [
        { weekday: 1, startTime: "09:00", endTime: "11:00" }
      ]
    });

    await repository.savePlanGeneration({
      planId: plan.id,
      tasks: [
        {
          id: "task1",
          phase: "phase1",
          title: "学习任务1",
          description: "描述",
          estimatedMinutes: 60,
          priority: 1,
          acceptanceCriteria: ["完成练习"],
          orderIndex: 0
        }
      ],
      sessions: [
        {
          taskId: "task1",
          startAt: new Date("2026-07-06T09:00:00.000Z"),
          endAt: new Date("2026-07-06T10:00:00.000Z"),
          durationMinutes: 60,
          status: "scheduled" as const
        }
      ],
      busySlots: [],
      warnings: []
    });

    // 模拟已经同步
    const sessions = (await repository.getPlan(plan.id))!.sessions;
    await repository.updateSessionExternalEventId(sessions[0].id, "feishu_evt_existing");

    const mockCalendarProvider = {
      getBusySlots: vi.fn().mockResolvedValue([]),
      createCalendarEvent: vi.fn().mockResolvedValue({
        externalEventId: "feishu_evt_new",
        title: "学习任务1",
        description: "",
        startAt: new Date(),
        endAt: new Date()
      }),
      updateCalendarEvent: vi.fn().mockResolvedValue({}),
      deleteCalendarEvent: vi.fn().mockResolvedValue(undefined)
    };

    const result = await syncSessionsToCalendar(plan.id, {
      repository,
      calendarProvider: mockCalendarProvider as unknown as CalendarProvider,
      userId: USER_ID
    });

    expect(result.syncedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(mockCalendarProvider.createCalendarEvent).not.toHaveBeenCalled();
  });

  it("无 scheduled session 时应返回空结果", async () => {
    const repository = createInMemoryPlanRepository();
    const plan = await repository.createPlan({
      userId: "u1",
      title: "空计划",
      goal: "无任务",
      totalMinutes: 120,
      startDate: new Date("2026-07-06"),
      deadline: new Date("2026-07-12"),
      rescheduleBufferMinutes: 15,
      status: "draft",
      availability: [
        { weekday: 1, startTime: "09:00", endTime: "11:00" }
      ]
    });

    const result = await syncSessionsToCalendar(plan.id, { repository, userId: USER_ID });

    expect(result.totalSessions).toBe(0);
    expect(result.syncedCount).toBe(0);
  });
});
