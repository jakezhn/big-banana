import type { MarketPipelineReadModel } from "@big-banana/domain";
import type { HermesMarketRole } from "../planner/get-hermes-market-role";

export const OPENAI_POST_PLAN_REVIEW_PROMPT_VERSION =
  "openai-post-plan-review-v1";

export function buildOpenAiPostPlanReviewSystemPrompt(
  marketRole?: HermesMarketRole
): string {
  return [
    "You are a post-plan trading review generator.",
    "Return only a JSON object that satisfies the provided post-plan review schema.",
    "Do not add markdown, explanation, or extra keys.",
    "Use only the factual pipeline snapshot that is provided.",
    "Do not claim lessons that are broader than the available evidence.",
    "Keep lesson candidates scoped and conservative.",
    ...(marketRole?.systemPromptAppendix ?? [])
  ].join(" ");
}

export function buildOpenAiPostPlanReviewUserPrompt(
  pipeline: MarketPipelineReadModel,
  marketRole?: HermesMarketRole
): string {
  return JSON.stringify(
    {
      task: "Generate a post-plan review for this completed or reviewable market pipeline.",
      agent_scope: {
        role: marketRole?.roleId ?? "generic"
      },
      runtime_constraints: {
        mode: "single_timeframe_reasoning",
        note: "Do not write long-term memory; only propose lesson candidates."
      },
      market_pipeline: pipeline
    },
    null,
    2
  );
}
