import {
  generateDeterministicPlanRevision,
  type PlanRevisionGenerator,
  type PlannerRunnerInfo
} from "@big-banana/domain";
import type { AgentJobMarket } from "@big-banana/domain";
import {
  getHermesMarketRole,
  type HermesMarketRoleId
} from "../planner/get-hermes-market-role";
import { getOpenAiPlannerConfigFromEnv } from "../planner/get-openai-planner-config-from-env";
import {
  getPlannerRuntimeFromEnv,
  type PlannerRuntime
} from "../planner/get-planner-runtime-from-env";
import { createOpenAiPlanRevisionGenerator } from "./create-openai-plan-revision-generator";
import { OPENAI_PLAN_REVISION_PROMPT_VERSION } from "./build-openai-plan-revision-prompt";

export type ConfiguredPlanRevisionGenerator = {
  runtime: PlannerRuntime;
  marketRole: HermesMarketRoleId;
  runner: PlannerRunnerInfo;
  generator: PlanRevisionGenerator;
};

export function createPlanRevisionGeneratorFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: {
    market?: AgentJobMarket | null;
  } = {}
): ConfiguredPlanRevisionGenerator {
  const runtime = getPlannerRuntimeFromEnv(env);
  const marketRole = getHermesMarketRole(options.market);
  const skillName = marketRole.promptVersionSuffix
    ? `revise_trade_plan.${marketRole.promptVersionSuffix}`
    : "revise_trade_plan";

  if (runtime === "openai") {
    const config = getOpenAiPlannerConfigFromEnv(env);
    const promptVersion = marketRole.promptVersionSuffix
      ? `${OPENAI_PLAN_REVISION_PROMPT_VERSION}:${marketRole.promptVersionSuffix}`
      : OPENAI_PLAN_REVISION_PROMPT_VERSION;

    return {
      runtime,
      marketRole: marketRole.roleId,
      runner: {
        runnerKind: "openai",
        modelProvider: "openai",
        model: config.model,
        skillName,
        promptVersion
      },
      generator: createOpenAiPlanRevisionGenerator(config, { marketRole })
    };
  }

  const promptVersion = marketRole.promptVersionSuffix
    ? `deterministic-plan-revision-v1:${marketRole.promptVersionSuffix}`
    : "deterministic-plan-revision-v1";

  return {
    runtime,
    marketRole: marketRole.roleId,
    runner: {
      runnerKind: "deterministic",
      modelProvider: null,
      model: null,
      skillName,
      promptVersion
    },
    generator: ({ plannerInput, activePlan }) =>
      generateDeterministicPlanRevision(plannerInput, activePlan)
  };
}
