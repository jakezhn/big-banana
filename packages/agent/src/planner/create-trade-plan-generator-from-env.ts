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
import {
  getHermesMarketRole,
  type HermesMarketRoleId
} from "./get-hermes-market-role";
import type { AgentJobMarket } from "@big-banana/domain";

export type ConfiguredTradePlanGenerator = {
  runtime: PlannerRuntime;
  marketRole: HermesMarketRoleId;
  runner: PlannerRunnerInfo;
  generator: TradePlanGenerator;
};

export function createTradePlanGeneratorFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: {
    market?: AgentJobMarket | null;
  } = {}
): ConfiguredTradePlanGenerator {
  const runtime = getPlannerRuntimeFromEnv(env);
  const marketRole = getHermesMarketRole(options.market);

  if (runtime === "openai") {
    const config = getOpenAiPlannerConfigFromEnv(env);
    const promptVersion = marketRole.promptVersionSuffix
      ? `${OPENAI_TRADE_PLAN_PROMPT_VERSION}:${marketRole.promptVersionSuffix}`
      : OPENAI_TRADE_PLAN_PROMPT_VERSION;

    return {
      runtime,
      marketRole: marketRole.roleId,
      runner: {
        runnerKind: "openai",
        modelProvider: "openai",
        model: config.model,
        skillName: marketRole.skillName,
        promptVersion
      },
      generator: createOpenAiTradePlanGenerator(config, { marketRole })
    };
  }

  const promptVersion = marketRole.promptVersionSuffix
    ? `deterministic-v1:${marketRole.promptVersionSuffix}`
    : "deterministic-v1";

  return {
    runtime,
    marketRole: marketRole.roleId,
    runner: {
      runnerKind: "deterministic",
      modelProvider: null,
      model: null,
      skillName: marketRole.skillName,
      promptVersion
    },
    generator: ({ plannerInput, reusablePlan }) =>
      generateDeterministicTradePlan(plannerInput, reusablePlan)
  };
}
