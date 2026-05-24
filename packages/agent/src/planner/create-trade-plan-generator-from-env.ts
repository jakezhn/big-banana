import {
  generateDeterministicTradePlan,
  type PlannerRunnerInfo,
  type TradePlanGenerator
} from "@big-banana/domain";
import { OPENAI_TRADE_PLAN_PROMPT_VERSION } from "./build-openai-trade-plan-prompt";
import { createOpenAiTradePlanGenerator } from "./create-openai-trade-plan-generator";
import { getOpenAiPlannerConfigFromEnv } from "./get-openai-planner-config-from-env";
import {
  getPlannerRuntimeFromEnv,
  type PlannerRuntime
} from "./get-planner-runtime-from-env";

export type ConfiguredTradePlanGenerator = {
  runtime: PlannerRuntime;
  runner: PlannerRunnerInfo;
  generator: TradePlanGenerator;
};

export function createTradePlanGeneratorFromEnv(
  env: NodeJS.ProcessEnv = process.env
): ConfiguredTradePlanGenerator {
  const runtime = getPlannerRuntimeFromEnv(env);

  if (runtime === "openai") {
    const config = getOpenAiPlannerConfigFromEnv(env);

    return {
      runtime,
      runner: {
        runnerKind: "openai",
        modelProvider: "openai",
        model: config.model,
        skillName: "generate_trade_plan",
        promptVersion: OPENAI_TRADE_PLAN_PROMPT_VERSION
      },
      generator: createOpenAiTradePlanGenerator(config)
    };
  }

  return {
    runtime,
    runner: {
      runnerKind: "deterministic",
      modelProvider: null,
      model: null,
      skillName: "generate_trade_plan",
      promptVersion: "deterministic-v1"
    },
    generator: ({ plannerInput, reusablePlan }) =>
      generateDeterministicTradePlan(plannerInput, reusablePlan)
  };
}
