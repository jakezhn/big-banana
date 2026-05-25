import {
  validatePostPlanReview,
  type PostPlanReview
} from "@big-banana/contracts";
import type {
  AgentRunRepository,
  StoredAgentRun
} from "../agent-runs/agent-run-repository";
import type { JsonValue } from "../orders/order-repository";
import type {
  MarketPipelineReadModel,
  MarketPipelineReadModelRepository
} from "../read-models/market-pipeline-read-model-repository";
import type { PlannerRunnerInfo } from "../planner/generate-and-record-trade-plan-with-generator";
import type {
  PostPlanReviewRepository,
  StoredPostPlanReview
} from "./post-plan-review-repository";

export class MissingReviewableMarketPipelineError extends Error {
  constructor() {
    super("Post-plan review requires a market pipeline with a persisted trade plan");
    this.name = "MissingReviewableMarketPipelineError";
  }
}

export class InvalidGeneratedPostPlanReviewError extends Error {
  constructor() {
    super("Generated post-plan review does not satisfy the frozen schema");
    this.name = "InvalidGeneratedPostPlanReviewError";
  }
}

export type GeneratedPostPlanReviewResult = {
  postPlanReview: PostPlanReview;
  tokenUsageJson?: JsonValue | null;
};

export type PostPlanReviewGeneratorContext = {
  pipeline: MarketPipelineReadModel;
};

export type PostPlanReviewGenerator = (
  context: PostPlanReviewGeneratorContext
) =>
  | Promise<PostPlanReview | GeneratedPostPlanReviewResult>
  | PostPlanReview
  | GeneratedPostPlanReviewResult;

export type GenerateAndRecordPostPlanReviewWithGeneratorResult = {
  pipeline: MarketPipelineReadModel;
  postPlanReview: PostPlanReview;
  agentRun: StoredAgentRun;
  review: StoredPostPlanReview;
};

export async function generateAndRecordPostPlanReviewWithGenerator(
  marketKey: string,
  sourceEventKey: string,
  marketPipelineReadModelRepository: MarketPipelineReadModelRepository,
  postPlanReviewRepository: PostPlanReviewRepository,
  agentRunRepository: AgentRunRepository,
  generator: PostPlanReviewGenerator,
  runner: PlannerRunnerInfo,
  startedAt = new Date().toISOString()
): Promise<GenerateAndRecordPostPlanReviewWithGeneratorResult> {
  const startedAtMs = Date.parse(startedAt);

  try {
    const pipeline =
      await marketPipelineReadModelRepository.getLatestMarketPipeline(marketKey);

    if (!pipeline?.tradePlanVersion) {
      throw new MissingReviewableMarketPipelineError();
    }

    const generated = await generator({ pipeline });
    const generatedResult = normalizeGeneratedPostPlanReviewResult(generated);
    const postPlanReview = generatedResult.postPlanReview;

    if (!validatePostPlanReview(postPlanReview)) {
      throw new InvalidGeneratedPostPlanReviewError();
    }

    const completedAt = new Date().toISOString();
    const agentRun = await agentRunRepository.recordAgentRun({
      marketKey,
      sourceEventKey,
      operation: "plan.review",
      runnerKind: runner.runnerKind,
      modelProvider: runner.modelProvider,
      model: runner.model,
      skillName: runner.skillName,
      promptVersion: runner.promptVersion,
      status: "success",
      inputSummary: buildInputSummary(pipeline),
      outputSummary: buildOutputSummary(postPlanReview, pipeline),
      tokenUsageJson: generatedResult.tokenUsageJson ?? null,
      executionEligible: null,
      tradePlanVersionId: pipeline.tradePlanVersion.id,
      errorMessage: null,
      startedAt,
      completedAt,
      latencyMs: Math.max(0, Date.parse(completedAt) - startedAtMs)
    });

    const review = await postPlanReviewRepository.recordPostPlanReview({
      planId: pipeline.tradePlanVersion.planId,
      tradePlanVersionId: pipeline.tradePlanVersion.id,
      marketKey,
      sourceEventKey,
      outcomeSummary: postPlanReview.outcome_summary,
      whatWorked: postPlanReview.what_worked,
      whatFailed: postPlanReview.what_failed,
      missedContext: postPlanReview.missed_context,
      earlyWarningSignals: postPlanReview.early_warning_signals,
      lessonCandidates: postPlanReview.lesson_candidates,
      shouldUpdateStrategyMemory: postPlanReview.should_update_strategy_memory,
      agentRunId: agentRun.id,
      createdAt: completedAt
    });

    return {
      pipeline,
      postPlanReview,
      agentRun,
      review
    };
  } catch (error) {
    const completedAt = new Date().toISOString();

    await agentRunRepository.recordAgentRun({
      marketKey,
      sourceEventKey,
      operation: "plan.review",
      runnerKind: runner.runnerKind,
      modelProvider: runner.modelProvider,
      model: runner.model,
      skillName: runner.skillName,
      promptVersion: runner.promptVersion,
      status:
        error instanceof InvalidGeneratedPostPlanReviewError
          ? "invalid_output"
          : "failed",
      inputSummary: {
        market_key: marketKey
      },
      outputSummary: null,
      tokenUsageJson: null,
      executionEligible: null,
      tradePlanVersionId: null,
      errorMessage: error instanceof Error ? error.message : "Unknown agent error",
      startedAt,
      completedAt,
      latencyMs: Math.max(0, Date.parse(completedAt) - startedAtMs)
    });

    throw error;
  }
}

function normalizeGeneratedPostPlanReviewResult(
  value: PostPlanReview | GeneratedPostPlanReviewResult
): GeneratedPostPlanReviewResult {
  if ("postPlanReview" in value) {
    return value;
  }

  return { postPlanReview: value };
}

function buildInputSummary(
  pipeline: MarketPipelineReadModel
): Record<string, JsonValue> {
  return {
    market_key: pipeline.marketKey,
    has_trade_plan: pipeline.tradePlanVersion !== null,
    has_risk_verdict: pipeline.riskVerdict !== null,
    latest_order_status: pipeline.latestOrder?.status ?? null,
    has_fill: pipeline.latestFill !== null,
    current_position_side: pipeline.currentPosition?.positionSide ?? null
  };
}

function buildOutputSummary(
  review: PostPlanReview,
  pipeline: MarketPipelineReadModel
): Record<string, JsonValue> {
  return {
    lesson_candidates_count: review.lesson_candidates.length,
    should_update_strategy_memory: review.should_update_strategy_memory,
    trade_plan_version_id: pipeline.tradePlanVersion?.id ?? null
  };
}
