import {
  createPostPlanReviewGeneratorFromEnv,
  parsePostPlanReviewJobPayload
} from "@big-banana/agent";
import type {
  AgentRunRepository,
  JsonValue,
  MarketPipelineReadModelRepository,
  PostPlanReviewRepository
} from "@big-banana/domain";
import { generateAndRecordPostPlanReviewWithGenerator } from "@big-banana/domain";
import type { AgentJobHandler } from "../agent-job-handler";
import type { AgentJobMarket } from "@big-banana/domain";

export type PostPlanReviewHandlerDependencies = {
  marketPipelineReadModelRepository: MarketPipelineReadModelRepository;
  postPlanReviewRepository: PostPlanReviewRepository;
  agentRunRepository: AgentRunRepository;
};

export function createPostPlanReviewHandler(
  dependencies: PostPlanReviewHandlerDependencies,
  env: NodeJS.ProcessEnv = process.env
): AgentJobHandler {
  const configuredGenerators = new Map<
    AgentJobMarket,
    ReturnType<typeof createPostPlanReviewGeneratorFromEnv>
  >();

  return async (job) => {
    const configuredGenerator = getConfiguredGenerator(
      job.market,
      configuredGenerators,
      env
    );
    const payload = parsePostPlanReviewJobPayload(job.payloadJson);

    const result = await generateAndRecordPostPlanReviewWithGenerator(
      payload.marketKey,
      payload.sourceEventKey,
      dependencies.marketPipelineReadModelRepository,
      dependencies.postPlanReviewRepository,
      dependencies.agentRunRepository,
      configuredGenerator.generator,
      configuredGenerator.runner,
      job.lockedAt ?? undefined
    );

    return {
      jobType: job.jobType,
      market: job.market,
      symbol: job.symbol,
      timeframe: job.timeframe,
      trigger: payload.trigger,
      marketKey: payload.marketKey,
      sourceEventKey: payload.sourceEventKey,
      planId: result.review.planId,
      tradePlanVersionId: result.review.tradePlanVersionId,
      agentRunId: result.agentRun.id,
      postPlanReviewId: result.review.id,
      lessonCandidateCount: result.review.lessonCandidates.length,
      shouldUpdateStrategyMemory: result.review.shouldUpdateStrategyMemory
    } satisfies Record<string, JsonValue>;
  };
}

function getConfiguredGenerator(
  market: AgentJobMarket,
  cache: Map<
    AgentJobMarket,
    ReturnType<typeof createPostPlanReviewGeneratorFromEnv>
  >,
  env: NodeJS.ProcessEnv
): ReturnType<typeof createPostPlanReviewGeneratorFromEnv> {
  const existing = cache.get(market);

  if (existing) {
    return existing;
  }

  const created = createPostPlanReviewGeneratorFromEnv(env, { market });
  cache.set(market, created);
  return created;
}
