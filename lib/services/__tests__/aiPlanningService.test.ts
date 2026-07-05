import { describe, expect, it } from "vitest";

import {
  generateLearningTasks,
  MockAiPlanningProvider,
  validateGeneratedTasks
} from "../aiPlanningService";
import type { GeneratedLearningTask } from "../aiPlanningService";

describe("aiPlanningService", () => {
  it("generates structured mock learning tasks", async () => {
    const result = await generateLearningTasks({
      title: "React learning plan",
      goal: "Learn React fundamentals",
      totalMinutes: 180
    });

    expect(result.tasks).toHaveLength(9);
    expect(result.tasks.map((task) => task.orderIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8
    ]);
    expect(result.tasks.map((task) => task.phase)).toEqual([
      "基础",
      "基础",
      "基础",
      "Hooks",
      "Hooks",
      "Router",
      "Router",
      "项目实战",
      "项目实战"
    ]);
    expect(result.tasks.every((task) => task.acceptanceCriteria.length > 0)).toBe(true);
    expect(totalMinutes(result.tasks)).toBe(180);
  });

  it("uses an injected provider boundary for future real AI integrations", async () => {
    const provider = new MockAiPlanningProvider([
      validTask({ id: "custom-1", title: "Custom task", estimatedMinutes: 30 })
    ]);

    const result = await generateLearningTasks(
      {
        title: "Custom plan",
        goal: "Use injected provider",
        totalMinutes: 30
      },
      provider
    );

    expect(result.tasks).toEqual([
      validTask({ id: "custom-1", title: "Custom task", estimatedMinutes: 30 })
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("accepts valid generated tasks without warnings", () => {
    const result = validateGeneratedTasks({
      targetTotalMinutes: 60,
      tasks: [validTask({ estimatedMinutes: 60 })]
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("rejects generated tasks without a title", () => {
    const result = validateGeneratedTasks({
      targetTotalMinutes: 60,
      tasks: [validTask({ title: "" })]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "task.title.required",
      message: "Generated task title is required.",
      index: 0,
      field: "title"
    });
  });

  it("rejects generated tasks with non-positive estimated minutes", () => {
    const result = validateGeneratedTasks({
      targetTotalMinutes: 60,
      tasks: [validTask({ estimatedMinutes: 0 })]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "task.estimatedMinutes.positive",
      message: "Generated task estimated minutes must be greater than 0.",
      index: 0,
      field: "estimatedMinutes"
    });
  });

  it("rejects generated tasks with empty acceptance criteria", () => {
    const result = validateGeneratedTasks({
      targetTotalMinutes: 60,
      tasks: [validTask({ acceptanceCriteria: [] })]
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual({
      code: "task.acceptanceCriteria.required",
      message: "Generated task must include at least one acceptance criterion.",
      index: 0,
      field: "acceptanceCriteria"
    });
  });

  it("warns when generated total minutes differs too much from target", () => {
    const result = validateGeneratedTasks({
      targetTotalMinutes: 120,
      tasks: [validTask({ estimatedMinutes: 60 })]
    });

    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([
      {
        code: "task.totalMinutes.deviation",
        message: "Generated task minutes differ from the target by more than 10%.",
        targetTotalMinutes: 120,
        generatedTotalMinutes: 60
      }
    ]);
  });
});

function validTask(
  overrides: Partial<GeneratedLearningTask> = {}
): GeneratedLearningTask {
  return {
    id: "task-1",
    phase: "Basics",
    title: "Learn core concepts",
    description: "Study the core concepts and take notes.",
    estimatedMinutes: 60,
    priority: 1,
    acceptanceCriteria: ["Can explain the core concepts."],
    orderIndex: 0,
    ...overrides
  };
}

function totalMinutes(tasks: GeneratedLearningTask[]): number {
  return tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);
}
