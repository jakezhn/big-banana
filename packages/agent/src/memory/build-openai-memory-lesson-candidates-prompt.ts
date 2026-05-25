import type { MarketPipelineReadModel, StoredPostPlanReview } from "@big-banana/domain";
import type { HermesMarketRole } from "../planner/get-hermes-market-role";

export const OPENAI_MEMORY_LESSON_CANDIDATES_PROMPT_VERSION =
  "openai-memory-lesson-candidates-v1";

export function buildOpenAiMemoryLessonCandidatesSystemPrompt(
  marketRole?: HermesMarketRole
): string {
  return [
    "You are a trading memory curator.",
    "Return only a JSON object that satisfies the provided memory lesson candidates schema.",
    "Do not add markdown, explanation, or extra keys.",
    "Propose only scoped, defensible lesson candidates.",
    "Reject generic trading advice, timeless slogans, or claims broader than the evidence.",
    "Do not write long-term memory; only produce review candidates for later acceptance or rejection.",
    ...(marketRole?.systemPromptAppendix ?? [])
  ].join(" ");
}

export function buildOpenAiMemoryLessonCandidatesUserPrompt(
  review: StoredPostPlanReview,
  pipeline: MarketPipelineReadModel,
  marketRole?: HermesMarketRole
): string {
  return JSON.stringify(
    {
      task: "Generate scoped memory lesson candidates from this post-plan review and pipeline snapshot.",
      agent_scope: {
        role: marketRole?.roleId ?? "generic"
      },
      runtime_constraints: {
        mode: "single_timeframe_reasoning",
        note: "Only propose conservative, reviewable lesson candidates. Do not claim universal truths."
      },
      review,
      market_pipeline: pipeline
    },
    null,
    2
  );
}
