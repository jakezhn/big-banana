import type { SignalWebhookPayloadV12 } from "@big-banana/contracts";
import type {
  AgentRunRepository,
  MarketStateRepository,
  OrderRepository,
  PositionRepository,
  ReceivedAgentRun,
  ReceivedMarketState,
  ReceivedPlanTransition,
  ReceivedPositionHistoryEntry,
  StoredAgentRun,
  StoredMarketState,
  StoredOrder,
  StoredPlanTransition,
  StoredPositionHistoryEntry,
  StoredPositionSnapshot,
  StoredTradePlanVersion,
  TradePlanVersionRepository
} from "@big-banana/domain";
import { describe, expect, it } from "vitest";
import { defaultReplayPlannerFixtures } from "../src/replay/default-replay-planner-fixtures";
import {
  buildReplayPlannerPayloadFromFixture,
  parseReplayPlannerResultRef
} from "../src/replay/replay-planner-harness";
import { createReplayPlannerHandler } from "../src/worker/replay/replay-planner-handler";

describe("createReplayPlannerHandler", () => {
  it("runs a real deterministic replay and returns structured summary", async () => {
    const fixture = defaultReplayPlannerFixtures[0]!;
    const marketStateRepository = new InMemoryMarketStateRepository([
      buildStoredMarketState(fixture.rawPayload)
    ]);
    const tradePlanVersionRepository = new InMemoryTradePlanVersionRepository();
    const orderRepository = new InMemoryOrderRepository();
    const positionRepository = new InMemoryPositionRepository();
    const agentRunRepository = new InMemoryAgentRunRepository();

    const handler = createReplayPlannerHandler(
      {
        marketStateRepository,
        tradePlanVersionRepository,
        orderRepository,
        positionRepository,
        agentRunRepository,
        tradingAccountId: "paper-tradingview"
      },
      {
        PLANNER_RUNTIME: "deterministic"
      } satisfies NodeJS.ProcessEnv
    );

    const result = await handler(
      {
        id: "job-1",
        jobType: "replay_planner",
        status: "running",
        market: fixture.market,
        symbol: fixture.symbol,
        timeframe: fixture.timeframe,
        signalId: "sig-1",
        planId: null,
        priority: 1,
        idempotencyKey: "replay:test",
        payloadJson: buildReplayPlannerPayloadFromFixture(fixture),
        resultRefJson: null,
        lockedBy: "hermes-test",
        lockedAt: "2026-05-24T10:00:00.000Z",
        lockedUntil: "2026-05-24T10:01:00.000Z",
        attemptCount: 0,
        maxAttempts: 2,
        runAfter: "2026-05-24T09:59:00.000Z",
        lastError: null,
        createdAt: "2026-05-24T09:59:00.000Z",
        updatedAt: "2026-05-24T10:00:00.000Z"
      },
      {
        now: () => "2026-05-24T10:00:01.000Z",
        logger: console
      }
    );

    const parsed = parseReplayPlannerResultRef(result);

    expect(parsed).toMatchObject({
      fixtureId: fixture.fixtureId,
      jobType: "replay_planner",
      market: fixture.market,
      symbol: fixture.symbol,
      timeframe: fixture.timeframe,
      marketKey: `${fixture.rawPayload.context.market.tickerid}:${fixture.rawPayload.context.market.timeframe}`,
      runnerKind: "deterministic",
      executionEligible: true
    });
    expect(typeof parsed.agentRunId).toBe("string");
    expect(agentRunRepository.runs).toHaveLength(1);
    expect(agentRunRepository.runs[0]?.operation).toBe("plan.replay");
    expect(agentRunRepository.runs[0]?.skillName).toBe("generate_trade_plan.crypto");
    expect(agentRunRepository.runs[0]?.promptVersion).toBe("deterministic-v1:crypto");
    expect(tradePlanVersionRepository.latestByMarketKey.size).toBe(0);
  });
});

class InMemoryMarketStateRepository implements MarketStateRepository {
  constructor(private readonly states: StoredMarketState[]) {}

  async recordMarketState(state: ReceivedMarketState): Promise<StoredMarketState> {
    return {
      id: `ms-${this.states.length + 1}`,
      ...state
    };
  }

  async getLatestStatesByTickerid(tickerid: string): Promise<StoredMarketState[]> {
    return this.states.filter((state) => state.tickerid === tickerid);
  }

  async getRecentMarketStatesByMarketKey(
    marketKey: string,
    limit: number
  ): Promise<StoredMarketState[]> {
    return this.states
      .filter((state) => state.marketKey === marketKey)
      .sort((a, b) => a.barTimeMs - b.barTimeMs)
      .slice(-limit);
  }
}

class InMemoryTradePlanVersionRepository implements TradePlanVersionRepository {
  latestByMarketKey = new Map<string, StoredTradePlanVersion>();

  async getLatestTradePlanVersion(
    _planId: string
  ): Promise<StoredTradePlanVersion | null> {
    return null;
  }

  async getLatestTradePlanVersionByMarketKey(
    marketKey: string
  ): Promise<StoredTradePlanVersion | null> {
    return this.latestByMarketKey.get(marketKey) ?? null;
  }

  async recordTradePlanVersion(): Promise<StoredTradePlanVersion> {
    throw new Error("Replay should not persist trade plan versions");
  }

  async recordPlanTransition(
    _transition: ReceivedPlanTransition
  ): Promise<StoredPlanTransition> {
    throw new Error("Replay should not record plan transitions");
  }
}

class InMemoryAgentRunRepository implements AgentRunRepository {
  runs: StoredAgentRun[] = [];

  async recordAgentRun(run: ReceivedAgentRun): Promise<StoredAgentRun> {
    const stored: StoredAgentRun = {
      id: `run-${this.runs.length + 1}`,
      ...run
    };

    this.runs.push(stored);
    return stored;
  }
}

class InMemoryOrderRepository implements OrderRepository {
  async getLatestOrderByExecutionIntentId(): Promise<StoredOrder | null> {
    return null;
  }

  async getOpenOrdersByTradingAccountIdAndSymbol(): Promise<StoredOrder[]> {
    return [];
  }

  async recordOrder(): Promise<StoredOrder> {
    throw new Error("Not used in replay handler test");
  }

  async updateOrderStatus(): Promise<StoredOrder> {
    throw new Error("Not used in replay handler test");
  }
}

class InMemoryPositionRepository implements PositionRepository {
  async getCurrentPosition(): Promise<StoredPositionSnapshot | null> {
    return null;
  }

  async upsertCurrentPosition(): Promise<StoredPositionSnapshot> {
    throw new Error("Not used in replay handler test");
  }

  async recordPositionHistory(
    _entry: ReceivedPositionHistoryEntry
  ): Promise<StoredPositionHistoryEntry> {
    throw new Error("Not used in replay handler test");
  }
}

function buildStoredMarketState(
  payload: SignalWebhookPayloadV12
): StoredMarketState {
  return {
    id: "ms-1",
    marketKey: `${payload.context.market.tickerid}:${payload.context.market.timeframe}`,
    webhookEventId: "wh-1",
    tickerid: payload.context.market.tickerid,
    timeframe: payload.context.market.timeframe,
    barTimeMs: payload.context.bar.time_ms,
    context: payload.context,
    createdAt: "2026-05-24T09:59:00.000Z"
  };
}
