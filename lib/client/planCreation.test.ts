import { describe, expect, it } from "vitest";

import {
  buildCreatePlanPayload,
  checkAiConfigValid,
  createAndGeneratePlan,
  validatePlanCreationForm
} from "./planCreation";
import type { PlanCreationFormState } from "./planCreation";

describe("planCreation", () => {
  it("rejects a form without availability ranges", () => {
    const result = validatePlanCreationForm({
      ...validForm(),
      availability: []
    });

    expect(result.valid).toBe(false);
    expect(result.errors.availability).toBe(
      "At least one weekly availability range is required."
    );
  });

  it("rejects a deadline that is not later than the start date", () => {
    const result = validatePlanCreationForm({
      ...validForm(),
      deadline: "2026-07-01"
    });

    expect(result.valid).toBe(false);
    expect(result.errors.deadline).toBe("Deadline must be later than start date.");
  });

  it("builds the create plan payload from a valid form", () => {
    const payload = buildCreatePlanPayload(validForm());

    expect(payload).toEqual({
      title: "Learn React",
      goal: "Understand components, hooks, routing, and build a small app.",
      totalMinutes: 1800,
      startDate: "2026-07-06",
      deadline: "2026-07-31",
      rescheduleBufferMinutes: 15,
      availability: [
        { weekday: 1, startTime: "20:00", endTime: "22:00" },
        { weekday: 6, startTime: "09:00", endTime: "12:00" }
      ]
    });
  });

  it("creates a plan and then generates the schedule", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetcher = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });

      if (url === "/api/plans") {
        return jsonResponse({ id: "plan_1", title: "Learn React" }, 201);
      }

      return jsonResponse({
        planId: "plan_1",
        tasks: [],
        sessions: [],
        busySlots: [],
        warnings: []
      });
    };

    const result = await createAndGeneratePlan(validForm(), fetcher);

    expect(result.plan.id).toBe("plan_1");
    expect(result.generation.planId).toBe("plan_1");
    expect(calls.map((call) => call.url)).toEqual([
      "/api/plans",
      "/api/plans/plan_1/generate"
    ]);
  });

  it("returns an API error message when create fails", async () => {
    const fetcher = async () =>
      jsonResponse(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "availability is invalid.",
            details: {}
          }
        },
        400
      );

    await expect(createAndGeneratePlan(validForm(), fetcher)).rejects.toThrow(
      "availability is invalid."
    );
  });
});

describe("checkAiConfigValid", () => {
  it("returns null for mock provider (even with empty fields)", () => {
    const result = checkAiConfigValid({
      provider: "mock",
      openai: { baseUrl: "", model: "", apiKey: "" }
    });

    expect(result).toBeNull();
  });

  it("returns null for fully configured openai_compatible", () => {
    const result = checkAiConfigValid({
      provider: "openai_compatible",
      openai: {
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4",
        apiKey: "sk-test-key"
      }
    });

    expect(result).toBeNull();
  });

  it("returns error when apiKey is empty", () => {
    const result = checkAiConfigValid({
      provider: "openai_compatible",
      openai: {
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4",
        apiKey: ""
      }
    });

    expect(result).toContain("API Key");
    expect(result).toContain("AI 配置不完整");
  });

  it("returns error when baseUrl is empty", () => {
    const result = checkAiConfigValid({
      provider: "openai_compatible",
      openai: {
        baseUrl: "",
        model: "gpt-4",
        apiKey: "sk-test"
      }
    });

    expect(result).toContain("Base URL");
    expect(result).toContain("AI 配置不完整");
  });

  it("returns error when model is empty", () => {
    const result = checkAiConfigValid({
      provider: "openai_compatible",
      openai: {
        baseUrl: "https://api.openai.com/v1",
        model: "",
        apiKey: "sk-test"
      }
    });

    expect(result).toContain("Model");
    expect(result).toContain("AI 配置不完整");
  });

  it("lists all missing fields when everything is empty", () => {
    const result = checkAiConfigValid({
      provider: "openai_compatible",
      openai: { baseUrl: "", model: "", apiKey: "" }
    });

    expect(result).toContain("Base URL");
    expect(result).toContain("Model");
    expect(result).toContain("API Key");
  });
});

function validForm(): PlanCreationFormState {
  return {
    title: "Learn React",
    goal: "Understand components, hooks, routing, and build a small app.",
    totalMinutes: "1800",
    startDate: "2026-07-06",
    deadline: "2026-07-31",
    rescheduleBufferMinutes: "15",
    availability: [
      { weekday: 1, startTime: "20:00", endTime: "22:00" },
      { weekday: 6, startTime: "09:00", endTime: "12:00" }
    ]
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
