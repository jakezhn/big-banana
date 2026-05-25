import {
  createPlanRevisionGeneratorFromEnv,
  parseRevisePlanJobPayload
} from "@big-banana/agent";
import type {
  AgentRunRepository,
  JsonValue,
  MarketStateRepository,
  OrderRepository,
  PlanRevisionSuggestionRepository,
  PositionRepository,
  TradePlanVersionRepository
} from "@big-banana/domain";
import { generateAndRecordPlanRevisionWithGenerator } from "@big-banana/domain";
import type { AgentJobHandler } from "../agent-job-handler";
import type { AgentJobMarket } from "@big-banana/domain";

export type RevisePlanHandlerDependencies = {
  marketStateRepository: MarketStateRepository;
  tradePlanVersionRepository: TradePlanVersionRepository;
  orderRepository: OrderRepository;
  positionRepository: PositionRepository;
  planRevisionSuggestionRepository: PlanRevisionSuggestionRepository;
  agentRunRepository: AgentRunRepository;
  tradingAccountId: string;
};

export function createRevisePlanHandler(
  dependencies: RevisePlanHandlerDependencies,
  env: NodeJS.ProcessEnv = process.env
): AgentJobHandler {
  const configuredGenerators = new Map<
    AgentJobMarket,
    ReturnType<typeof createPlanRevisionGeneratorFromEnv>
  >();

  return async (job) => {
    const configuredGenerator = getConfiguredGenerator(
      job.market,
      configuredGenerators,
      env
    );
    const payload = parseRevisePlanJobPayload(job.payloadJson);

    const result = await generateAndRecordPlanRevisionWithGenerator(
      payload.envelope,
      {
        marketStateRepository: dependencies.marketStateRepository,
        tradePlanVersionRepository: dependencies.tradePlanVersionRepository,
        orderRepository: dependencies.orderRepository,
        positionRepository: dependencies.positionRepository,
        tradingAccountId: dependencies.tradingAccountId
      },
      dependencies.planRevisionSuggestionRepository,
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
      sourceEventKey: payload.envelope.eventKey,
      planId: result.suggestion.planId,
      tradePlanVersionId: result.suggestion.tradePlanVersionId,
      revisionAction: result.planRevision.revision_action,
      requiresUserReview: result.planRevision.requires_user_review,
      agentRunId: result.agentRun.id,
      planRevisionSuggestionId: result.suggestion.id
    } satisfies Record<string, JsonValue>;
  };
}

function getConfiguredGenerator(
  market: AgentJobMarket,
  cache: Map<AgentJobMarket, ReturnType<typeof createPlanRevisionGeneratorFromEnv>>,
  env: NodeJS.ProcessEnv
): ReturnType<typeof createPlanRevisionGeneratorFromEnv> {
  const existing = cache.get(market);

  if (existing) {
    return existing;
  }

  const created = createPlanRevisionGeneratorFromEnv(env, { market });
  cache.set(market, created);
  return created;
}
