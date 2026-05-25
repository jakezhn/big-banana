import { describe, expect, it } from "vitest";
import {
  createTradePlanGeneratorFromEnv,
  MissingOpenAiPlannerApiKeyError
} from "@big-banana/agent";

describe("createTradePlanGeneratorFromEnv", () => {
  it("defaults to deterministic runtime", () => {
    const result = createTradePlanGeneratorFromEnv({});

    expect(result.runtime).toBe("deterministic");
    expect(result.marketRole).toBe("generic");
    expect(result.runner).toEqual({
      runnerKind: "deterministic",
      modelProvider: null,
      model: null,
      skillName: "generate_trade_plan",
      promptVersion: "deterministic-v1"
    });
  });

  it("derives a market-scoped deterministic role when market is provided", () => {
    const result = createTradePlanGeneratorFromEnv(
      {},
      { market: "crypto" }
    );

    expect(result.runtime).toBe("deterministic");
    expect(result.marketRole).toBe("crypto");
    expect(result.runner).toEqual({
      runnerKind: "deterministic",
      modelProvider: null,
      model: null,
      skillName: "generate_trade_plan.crypto",
      promptVersion: "deterministic-v1:crypto"
    });
  });

  it("fails fast when openai runtime is selected without an API key", () => {
    expect(() =>
      createTradePlanGeneratorFromEnv({
        PLANNER_RUNTIME: "openai",
        OPENAI_API_KEY: ""
      })
    ).toThrow(MissingOpenAiPlannerApiKeyError);
  });
});
