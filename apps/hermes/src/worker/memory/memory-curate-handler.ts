import {
  createMemoryLessonCandidatesGeneratorFromEnv,
  parseMemoryCurateJobPayload
} from "@big-banana/agent";
import type {
  AgentRunRepository,
  JsonValue,
  MarketPipelineReadModelRepository,
  MemoryLessonCandidateRepository,
  PostPlanReviewRepository
} from "@big-banana/domain";
import { generateAndRecordMemoryLessonCandidatesWithGenerator } from "@big-banana/domain";
import type { AgentJobHandler } from "../agent-job-handler";
import type { AgentJobMarket } from "@big-banana/domain";

export type MemoryCurateHandlerDependencies = {
  postPlanReviewRepository: PostPlanReviewRepository;
  marketPipelineReadModelRepository: MarketPipelineReadModelRepository;
  memoryLessonCandidateRepository: MemoryLessonCandidateRepository;
  agentRunRepository: AgentRunRepository;
};

export function createMemoryCurateHandler(
  dependencies: MemoryCurateHandlerDependencies,
  env: NodeJS.ProcessEnv = process.env
): AgentJobHandler {
  const configuredGenerators = new Map<
    AgentJobMarket,
    ReturnType<typeof createMemoryLessonCandidatesGeneratorFromEnv>
  >();

  return async (job) => {
    const configuredGenerator = getConfiguredGenerator(
      job.market,
      configuredGenerators,
      env
    );
    const payload = parseMemoryCurateJobPayload(job.payloadJson);

    const result = await generateAndRecordMemoryLessonCandidatesWithGenerator(
      payload.postPlanReviewId,
      dependencies.postPlanReviewRepository,
      dependencies.marketPipelineReadModelRepository,
      dependencies.memoryLessonCandidateRepository,
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
      marketKey: result.review.marketKey,
      sourceEventKey: result.review.sourceEventKey,
      planId: result.review.planId,
      tradePlanVersionId: result.review.tradePlanVersionId,
      postPlanReviewId: result.review.id,
      agentRunId: result.agentRun.id,
      memoryLessonCandidateCount: result.storedCandidates.length,
      rejectReasonCount: result.memoryLessonCandidates.reject_reasons.length
    } satisfies Record<string, JsonValue>;
  };
}

function getConfiguredGenerator(
  market: AgentJobMarket,
  cache: Map<
    AgentJobMarket,
    ReturnType<typeof createMemoryLessonCandidatesGeneratorFromEnv>
  >,
  env: NodeJS.ProcessEnv
): ReturnType<typeof createMemoryLessonCandidatesGeneratorFromEnv> {
  const existing = cache.get(market);

  if (existing) {
    return existing;
  }

  const created = createMemoryLessonCandidatesGeneratorFromEnv(env, { market });
  cache.set(market, created);
  return created;
}
