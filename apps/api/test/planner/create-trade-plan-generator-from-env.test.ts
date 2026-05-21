import { describe, expect, it } from "vitest";
import { createTradePlanGeneratorFromEnv } from "../../src/planner/create-trade-plan-generator-from-env";
import { MissingOpenAiPlannerApiKeyError } from "../../src/planner/create-openai-trade-plan-generator";

describe("createTradePlanGeneratorFromEnv", () => {
  it("defaults to deterministic runtime", () => {
    const result = createTradePlanGeneratorFromEnv({});

    expect(result.runtime).toBe("deterministic");
    expect(result.runner).toEqual({
      runnerKind: "deterministic",
      model: null
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
