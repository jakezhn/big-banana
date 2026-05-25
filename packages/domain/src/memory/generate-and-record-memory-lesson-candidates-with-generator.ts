import {
  validateMemoryLessonCandidates,
  type MemoryLessonCandidates
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
import type {
  MemoryLessonCandidateRepository,
  StoredMemoryLessonCandidate
} from "./memory-lesson-candidate-repository";
import type {
  PostPlanReviewRepository,
  StoredPostPlanReview
} from "../reviews/post-plan-review-repository";
import type { PlannerRunnerInfo } from "../planner/generate-and-record-trade-plan-with-generator";

export class MissingReviewForMemoryCurationError extends Error {
  constructor() {
    super("Memory curation requires a persisted post-plan review");
    this.name = "MissingReviewForMemoryCurationError";
  }
}

export class InvalidGeneratedMemoryLessonCandidatesError extends Error {
  constructor() {
    super("Generated memory lesson candidates do not satisfy the frozen schema");
    this.name = "InvalidGeneratedMemoryLessonCandidatesError";
  }
}

export type GeneratedMemoryLessonCandidatesResult = {
  memoryLessonCandidates: MemoryLessonCandidates;
  tokenUsageJson?: JsonValue | null;
};

export type MemoryLessonCandidateGeneratorContext = {
  review: StoredPostPlanReview;
  pipeline: MarketPipelineReadModel;
};

export type MemoryLessonCandidateGenerator = (
  context: MemoryLessonCandidateGeneratorContext
) =>
  | Promise<MemoryLessonCandidates | GeneratedMemoryLessonCandidatesResult>
  | MemoryLessonCandidates
  | GeneratedMemoryLessonCandidatesResult;

export type GenerateAndRecordMemoryLessonCandidatesWithGeneratorResult = {
  review: StoredPostPlanReview;
  pipeline: MarketPipelineReadModel;
  memoryLessonCandidates: MemoryLessonCandidates;
  agentRun: StoredAgentRun;
  storedCandidates: StoredMemoryLessonCandidate[];
};

export async function generateAndRecordMemoryLessonCandidatesWithGenerator(
  postPlanReviewId: string,
  postPlanReviewRepository: PostPlanReviewRepository,
  marketPipelineReadModelRepository: MarketPipelineReadModelRepository,
  memoryLessonCandidateRepository: MemoryLessonCandidateRepository,
  agentRunRepository: AgentRunRepository,
  generator: MemoryLessonCandidateGenerator,
  runner: PlannerRunnerInfo,
  startedAt = new Date().toISOString()
): Promise<GenerateAndRecordMemoryLessonCandidatesWithGeneratorResult> {
  const startedAtMs = Date.parse(startedAt);

  try {
    const review = await postPlanReviewRepository.getPostPlanReviewById(
      postPlanReviewId
    );

    if (!review) {
      throw new MissingReviewForMemoryCurationError();
    }

    const pipeline =
      await marketPipelineReadModelRepository.getLatestMarketPipeline(review.marketKey);

    if (!pipeline?.tradePlanVersion) {
      throw new MissingReviewForMemoryCurationError();
    }

    const generated = await generator({ review, pipeline });
    const generatedResult = normalizeGeneratedMemoryLessonCandidatesResult(generated);
    const memoryLessonCandidates = generatedResult.memoryLessonCandidates;

    if (!validateMemoryLessonCandidates(memoryLessonCandidates)) {
      throw new InvalidGeneratedMemoryLessonCandidatesError();
    }

    const completedAt = new Date().toISOString();
    const agentRun = await agentRunRepository.recordAgentRun({
      marketKey: review.marketKey,
      sourceEventKey: review.sourceEventKey,
      operation: "memory.curate",
      runnerKind: runner.runnerKind,
      modelProvider: runner.modelProvider,
      model: runner.model,
      skillName: runner.skillName,
      promptVersion: runner.promptVersion,
      status: "success",
      inputSummary: {
        post_plan_review_id: review.id,
        market_key: review.marketKey,
        lesson_candidates_count: review.lessonCandidates.length
      },
      outputSummary: {
        memory_items_count: memoryLessonCandidates.memory_items.length,
        reject_reasons_count: memoryLessonCandidates.reject_reasons.length
      },
      tokenUsageJson: generatedResult.tokenUsageJson ?? null,
      executionEligible: null,
      tradePlanVersionId: review.tradePlanVersionId,
      errorMessage: null,
      startedAt,
      completedAt,
      latencyMs: Math.max(0, Date.parse(completedAt) - startedAtMs)
    });

    const storedCandidates = await Promise.all(
      memoryLessonCandidates.memory_items.map((item) =>
        memoryLessonCandidateRepository.recordMemoryLessonCandidate({
          postPlanReviewId: review.id,
          planId: review.planId,
          tradePlanVersionId: review.tradePlanVersionId,
          marketKey: review.marketKey,
          sourceEventKey: review.sourceEventKey,
          lesson: item.lesson,
          scopeMarket: item.scope.market,
          scopeAssetClass: item.scope.asset_class,
          scopeSymbol: item.scope.symbol,
          scopeTimeframe: item.scope.timeframe,
          scopeRegime: item.scope.regime,
          scopeSignalType: item.scope.signal_type,
          confidence: item.confidence,
          sampleSize: item.sample_size,
          decayDays: item.decay_days,
          retrievalHint: item.retrieval_hint,
          status: "pending_review",
          agentRunId: agentRun.id,
          createdAt: completedAt
        })
      )
    );

    return {
      review,
      pipeline,
      memoryLessonCandidates,
      agentRun,
      storedCandidates
    };
  } catch (error) {
    const completedAt = new Date().toISOString();

    await agentRunRepository.recordAgentRun({
      marketKey: "unknown",
      sourceEventKey: `memory_curate:${postPlanReviewId}`,
      operation: "memory.curate",
      runnerKind: runner.runnerKind,
      modelProvider: runner.modelProvider,
      model: runner.model,
      skillName: runner.skillName,
      promptVersion: runner.promptVersion,
      status:
        error instanceof InvalidGeneratedMemoryLessonCandidatesError
          ? "invalid_output"
          : "failed",
      inputSummary: { post_plan_review_id: postPlanReviewId },
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

function normalizeGeneratedMemoryLessonCandidatesResult(
  value: MemoryLessonCandidates | GeneratedMemoryLessonCandidatesResult
): GeneratedMemoryLessonCandidatesResult {
  if ("memoryLessonCandidates" in value) {
    return value;
  }

  return { memoryLessonCandidates: value };
}
