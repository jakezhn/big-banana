import type { PostPlanReview } from "@big-banana/contracts";
import type { MarketPipelineReadModel } from "../read-models/market-pipeline-read-model-repository";

export function generateDeterministicPostPlanReview(
  pipeline: MarketPipelineReadModel
): PostPlanReview {
  const order = pipeline.latestOrder;
  const fill = pipeline.latestFill;
  const position = pipeline.currentPosition;
  const plan = pipeline.tradePlanVersion;
  const reviewableFill = fill !== null;

  if (reviewableFill) {
    const lessonCandidates = [
      "When the setup reaches terminal execution, compare post-entry range expansion against the original trigger quality before promoting similar future plans."
    ];

    return {
      outcome_summary:
        "The plan reached executed terminal flow and now has enough evidence for a structured post-plan review.",
      what_worked: [
        "The setup progressed from plan generation through deterministic risk and execution without breaking the workflow harness.",
        "A concrete fill was produced, giving the review a factual execution anchor."
      ],
      what_failed:
        position && position.positionSide !== "flat"
          ? ["The position remains open, so the final outcome is still partial and management quality must stay under review."]
          : [],
      missed_context: [],
      early_warning_signals:
        plan?.executionPlaybook.state === "managing"
          ? ["The plan remained in a managing-style posture late in the lifecycle, which may hide delayed invalidation signals."]
          : [],
      lesson_candidates: lessonCandidates,
      should_update_strategy_memory: lessonCandidates.length > 0
    };
  }

  return {
    outcome_summary:
      "The plan did not produce a concrete fill, so the review remains focused on execution readiness and lifecycle completion rather than trade outcome.",
    what_worked: order
      ? ["The plan reached order submission, which confirms that setup structure and deterministic risk were strong enough to proceed."]
      : [],
    what_failed: [
      order
        ? "Execution never produced a fill, so the setup lacks outcome evidence."
        : "The plan never advanced into a filled execution state, so the review remains incomplete."
    ],
    missed_context: [],
    early_warning_signals: order?.status === "canceled" ? ["The latest order was canceled before a factual fill occurred."] : [],
    lesson_candidates: [],
    should_update_strategy_memory: false
  };
}
