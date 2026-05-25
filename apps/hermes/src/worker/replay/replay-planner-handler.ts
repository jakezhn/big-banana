import { createTradePlanGeneratorFromEnv } from "@big-banana/agent";
import type {
  AgentJobMarket,
  AgentRunRepository,
  JsonValue,
  MarketStateRepository,
  OrderRepository,
  PositionRepository,
  StoredTradePlanVersion,
  TradePlanVersionRepository
} from "@big-banana/domain";
import { replayTradePlanWithAgentRun } from "@big-banana/domain";
import { type ReplayPlannerPayload } from "../../replay/replay-planner-harness";
import type { AgentJobHandler } from "../agent-job-handler";

export type ReplayPlannerHandlerDependencies = {
  marketStateRepository: MarketStateRepository;
  tradePlanVersionRepository: TradePlanVersionRepository;
  orderRepository: OrderRepository;
  positionRepository: PositionRepository;
  agentRunRepository: AgentRunRepository;
  tradingAccountId: string;
};

export function createReplayPlannerHandler(
  dependencies: ReplayPlannerHandlerDependencies,
  env: NodeJS.ProcessEnv = process.env
): AgentJobHandler {
  const configuredGenerators = new Map<
    AgentJobMarket,
    ReturnType<typeof createTradePlanGeneratorFromEnv>
  >();

  return async (job) => {
    const configuredGenerator = getConfiguredGenerator(
      job.market,
      configuredGenerators,
      env
    );
    const payload = parseReplayPlannerPayload(job.payloadJson);
    const replay = await replayTradePlanWithAgentRun(
      payload.rawPayload,
      {
        marketStateRepository: dependencies.marketStateRepository,
        tradePlanVersionRepository: dependencies.tradePlanVersionRepository,
        orderRepository: dependencies.orderRepository,
        positionRepository: dependencies.positionRepository,
        tradingAccountId: dependencies.tradingAccountId
      },
      dependencies.agentRunRepository,
      configuredGenerator.generator,
      configuredGenerator.runner,
      payload.receivedAt
    );

    return {
      fixtureId: payload.fixtureId ?? null,
      jobType: job.jobType,
      market: job.market,
      symbol: job.symbol,
      timeframe: job.timeframe,
      marketKey: replay.envelope.marketKey,
      sourceEventKey: replay.envelope.eventKey,
      agentRunId: replay.agentRun.id,
      runnerKind: replay.agentRun.runnerKind,
      modelProvider: replay.agentRun.modelProvider,
      model: replay.agentRun.model,
      promptVersion: replay.agentRun.promptVersion,
      action: replay.tradePlan.action,
      executionState: replay.tradePlan.execution_playbook.state,
      riskTier: replay.tradePlan.risk_intent.risk_tier,
      executionEligible: replay.agentRun.executionEligible,
      tokenUsageJson: replay.agentRun.tokenUsageJson
    } satisfies Record<string, JsonValue>;
  };
}

function getConfiguredGenerator(
  market: AgentJobMarket,
  cache: Map<AgentJobMarket, ReturnType<typeof createTradePlanGeneratorFromEnv>>,
  env: NodeJS.ProcessEnv
): ReturnType<typeof createTradePlanGeneratorFromEnv> {
  const existing = cache.get(market);

  if (existing) {
    return existing;
  }

  const created = createTradePlanGeneratorFromEnv(env, { market });
  cache.set(market, created);
  return created;
}

function parseReplayPlannerPayload(payloadJson: JsonValue): ReplayPlannerPayload {
  if (!payloadJson || typeof payloadJson !== "object" || Array.isArray(payloadJson)) {
    throw new Error("Replay planner payload must be an object");
  }

  if (!("rawPayload" in payloadJson)) {
    throw new Error("Replay planner payload must include rawPayload");
  }

  const receivedAt =
    typeof payloadJson.receivedAt === "string" ? payloadJson.receivedAt : undefined;

  return {
    fixtureId:
      typeof payloadJson.fixtureId === "string" ? payloadJson.fixtureId : undefined,
    rawPayload: payloadJson.rawPayload,
    receivedAt
  };
}
