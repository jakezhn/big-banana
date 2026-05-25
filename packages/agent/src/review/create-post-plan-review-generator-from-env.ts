import {
  generateDeterministicPostPlanReview,
  type PlannerRunnerInfo,
  type PostPlanReviewGenerator
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
import { createOpenAiPostPlanReviewGenerator } from "./create-openai-post-plan-review-generator";
import { OPENAI_POST_PLAN_REVIEW_PROMPT_VERSION } from "./build-openai-post-plan-review-prompt";

export type ConfiguredPostPlanReviewGenerator = {
  runtime: PlannerRuntime;
  marketRole: HermesMarketRoleId;
  runner: PlannerRunnerInfo;
  generator: PostPlanReviewGenerator;
};

export function createPostPlanReviewGeneratorFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: {
    market?: AgentJobMarket | null;
  } = {}
): ConfiguredPostPlanReviewGenerator {
  const runtime = getPlannerRuntimeFromEnv(env);
  const marketRole = getHermesMarketRole(options.market);
  const skillName = marketRole.promptVersionSuffix
    ? `review_trade_plan.${marketRole.promptVersionSuffix}`
    : "review_trade_plan";

  if (runtime === "openai") {
    const config = getOpenAiPlannerConfigFromEnv(env);
    const promptVersion = marketRole.promptVersionSuffix
      ? `${OPENAI_POST_PLAN_REVIEW_PROMPT_VERSION}:${marketRole.promptVersionSuffix}`
      : OPENAI_POST_PLAN_REVIEW_PROMPT_VERSION;

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
      generator: createOpenAiPostPlanReviewGenerator(config, { marketRole })
    };
  }

  const promptVersion = marketRole.promptVersionSuffix
    ? `deterministic-post-plan-review-v1:${marketRole.promptVersionSuffix}`
    : "deterministic-post-plan-review-v1";

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
    generator: ({ pipeline }) => generateDeterministicPostPlanReview(pipeline)
  };
}
