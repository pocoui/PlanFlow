import { describe, expect, it } from "vitest";

describe("project scaffold", () => {
  it("keeps the test runner wired", () => {
    expect("PlanFlow AI").toContain("PlanFlow");
  });
});
