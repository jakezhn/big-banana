import {
  generateDeterministicTradePlan,
  type PlannerRunnerInfo,
  type TradePlanGenerator
} from "@big-banana/domain";
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
        model: config.model
      },
      generator: createOpenAiTradePlanGenerator(config)
    };
  }

  return {
    runtime,
    runner: {
      runnerKind: "deterministic",
      model: null
    },
    generator: ({ plannerInput, reusablePlan }) =>
      generateDeterministicTradePlan(plannerInput, reusablePlan)
  };
}
