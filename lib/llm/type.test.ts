import { describe, expect, test } from "bun:test";

import { AgentSchema } from "./type";

describe("AgentSchema", () => {
  test("should accept reasoning enabled and effort when configured", () => {
    expect(
      AgentSchema.parse({
        description: "Uses deliberate reasoning.",
        reasoning: { enabled: true, effort: "high" },
      }),
    ).toMatchObject({ reasoning: { enabled: true, effort: "high" } });
  });

  test("should preserve existing defaults when reasoning is omitted", () => {
    expect(
      AgentSchema.parse({ description: "Existing agent." }),
    ).not.toHaveProperty("reasoning");
  });

  test("should reject contradictory reasoning when disabled with effort", () => {
    expect(() =>
      AgentSchema.parse({
        description: "Contradictory agent.",
        reasoning: { enabled: false, effort: "low" },
      }),
    ).toThrow();
  });

  test("should reject invalid reasoning effort", () => {
    expect(() =>
      AgentSchema.parse({
        description: "Invalid effort.",
        reasoning: { enabled: true, effort: "extreme" },
      }),
    ).toThrow();
  });
});
