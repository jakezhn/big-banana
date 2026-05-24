import type {
  AgentRunRepository,
  ExecutionIntentRepository,
  MarketStateRepository,
  OrderRepository,
  PositionRepository,
  ReceivedAgentRun,
  ReceivedExecutionIntent,
  ReceivedMarketState,
  ReceivedOrder,
  ReceivedOrderStatusUpdate,
  ReceivedPlanTransition,
  ReceivedPositionHistoryEntry,
  ReceivedPositionSnapshot,
  ReceivedRiskVerdict,
  ReceivedTradePlanVersion,
  ReceivedWebhookEvent,
  RiskPolicySnapshot,
  RiskVerdictRepository,
  StoredAgentRun,
  StoredExecutionIntent,
  StoredMarketState,
  StoredOrder,
  StoredPlanTransition,
  StoredPositionHistoryEntry,
  StoredPositionSnapshot,
  StoredRiskVerdict,
  StoredTradePlanVersion,
  StoredWebhookEvent,
  TradePlanVersionRepository,
  WebhookEventRepository
} from "@big-banana/domain";
import { describe, expect, it } from "vitest";
import { defaultReplayPlannerFixtures } from "../src/replay/default-replay-planner-fixtures";
import { createGeneratePlanHandler } from "../src/worker/planning/generate-plan-handler";

const riskPolicy: RiskPolicySnapshot = {
  tradingAccountId: "paper-tradingview",
  accountEquity: 20000,
  maxTradeRiskPct: 0.5,
  maxNotional: 100000,
  maxLeverage: 3,
  dailyLossLimitBreached: false,
  consecutiveLossLimitBreached: false,
  killSwitchEnabled: false,
  liveRequiresManualApproval: false
};

describe("createGeneratePlanHandler", () => {
  it("processes a full-mode signal job and updates webhook status", async () => {
    const fixture = defaultReplayPlannerFixtures[0]!;
    const webhookEventRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository([
      buildStoredMarketState(fixture.rawPayload)
    ]);
    const tradePlanVersionRepository = new InMemoryTradePlanVersionRepository();
    const agentRunRepository = new InMemoryAgentRunRepository();
    const riskVerdictRepository = new InMemoryRiskVerdictRepository();
    const executionIntentRepository = new InMemoryExecutionIntentRepository();
    const orderRepository = new InMemoryOrderRepository();
    const positionRepository = new InMemoryPositionRepository();

    const handler = createGeneratePlanHandler(
      {
        webhookEventRepository,
        marketStateRepository,
        tradePlanVersionRepository,
        agentRunRepository,
        riskVerdictRepository,
        executionIntentRepository,
        orderRepository,
        positionRepository
      },
      { PLANNER_RUNTIME: "deterministic" } satisfies NodeJS.ProcessEnv
    );

    const result = await handler(
      {
        id: "job-1",
        jobType: "generate_plan",
        status: "running",
        market: fixture.market,
        symbol: fixture.symbol,
        timeframe: fixture.timeframe,
        signalId: "sig-1",
        planId: null,
        priority: 1,
        idempotencyKey: "generate_plan:test",
        payloadJson: {
          webhookEventId: "wh-1",
          envelope: {
            source: "tradingview",
            sourceSchemaVersion: "bitpunk.webhook.v12",
            raw: fixture.rawPayload,
            type: "signal",
            eventKey: `${fixture.rawPayload.context.market.tickerid}:${fixture.rawPayload.context.market.timeframe}:${fixture.rawPayload.context.bar.time_ms}:signal`,
            marketKey: `${fixture.rawPayload.context.market.tickerid}:${fixture.rawPayload.context.market.timeframe}`,
            context: fixture.rawPayload.context,
            signal: fixture.rawPayload.signal
          },
          riskPolicy,
          pipelineMode: "full"
        },
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

    expect(result).toMatchObject({
      jobType: "generate_plan",
      processStatus: "order_submitted",
      pipelineMode: "full"
    });
    expect(webhookEventRepository.processStatuses).toEqual([["wh-1", "order_submitted"]]);
    expect([...tradePlanVersionRepository.versions.values()].flat()).toHaveLength(1);
    expect(agentRunRepository.runs).toHaveLength(1);
    expect(riskVerdictRepository.verdicts).toHaveLength(1);
    expect(executionIntentRepository.intents).toHaveLength(1);
    expect(orderRepository.orders).toHaveLength(1);
  });
});

class InMemoryWebhookEventRepository implements WebhookEventRepository {
  readonly events = new Map<string, StoredWebhookEvent>();
  readonly processStatuses: Array<[string, string]> = [];

  async recordReceivedEvent(
    event: ReceivedWebhookEvent
  ): Promise<StoredWebhookEvent> {
    const stored: StoredWebhookEvent = {
      ...event,
      id: "wh-1",
      lastReceivedAt: event.receivedAt,
      deliveryCount: 1,
      duplicate: false,
      processStatus: "received"
    };
    this.events.set(stored.id, stored);
    return stored;
  }

  async updateProcessStatus(
    webhookEventId: string,
    processStatus: string
  ): Promise<void> {
    this.processStatuses.push([webhookEventId, processStatus]);
  }
}

class InMemoryMarketStateRepository implements MarketStateRepository {
  constructor(private readonly states: StoredMarketState[]) {}

  async recordMarketState(
    state: ReceivedMarketState
  ): Promise<StoredMarketState> {
    return { id: crypto.randomUUID(), ...state };
  }

  async getLatestStatesByTickerid(tickerid: string): Promise<StoredMarketState[]> {
    return this.states.filter((state) => state.tickerid === tickerid);
  }

  async getRecentMarketStatesByMarketKey(
    marketKey: string,
    limit: number
  ): Promise<StoredMarketState[]> {
    return this.states.filter((state) => state.marketKey === marketKey).slice(-limit);
  }
}

class InMemoryTradePlanVersionRepository implements TradePlanVersionRepository {
  readonly versions = new Map<string, StoredTradePlanVersion[]>();

  async getLatestTradePlanVersion(
    planId: string
  ): Promise<StoredTradePlanVersion | null> {
    return (this.versions.get(planId) ?? []).at(-1) ?? null;
  }

  async getLatestTradePlanVersionByMarketKey(
    marketKey: string
  ): Promise<StoredTradePlanVersion | null> {
    const versions = [...this.versions.values()]
      .flat()
      .filter((version) => version.marketKey === marketKey);
    return versions.at(-1) ?? null;
  }

  async recordTradePlanVersion(
    version: ReceivedTradePlanVersion
  ): Promise<StoredTradePlanVersion> {
    const stored = { ...version, id: crypto.randomUUID() };
    const versions = this.versions.get(version.planId) ?? [];
    versions.push(stored);
    this.versions.set(version.planId, versions);
    return stored;
  }

  async recordPlanTransition(
    transition: ReceivedPlanTransition
  ): Promise<StoredPlanTransition> {
    return { ...transition, id: crypto.randomUUID() };
  }
}

class InMemoryAgentRunRepository implements AgentRunRepository {
  readonly runs: StoredAgentRun[] = [];

  async recordAgentRun(run: ReceivedAgentRun): Promise<StoredAgentRun> {
    const stored = { ...run, id: crypto.randomUUID() };
    this.runs.push(stored);
    return stored;
  }
}

class InMemoryRiskVerdictRepository implements RiskVerdictRepository {
  readonly verdicts: StoredRiskVerdict[] = [];

  async recordRiskVerdict(
    verdict: ReceivedRiskVerdict
  ): Promise<StoredRiskVerdict> {
    const stored = { ...verdict, id: crypto.randomUUID() };
    this.verdicts.push(stored);
    return stored;
  }
}

class InMemoryExecutionIntentRepository implements ExecutionIntentRepository {
  readonly intents: StoredExecutionIntent[] = [];

  async recordExecutionIntent(
    intent: ReceivedExecutionIntent
  ): Promise<StoredExecutionIntent> {
    const stored = { ...intent, id: crypto.randomUUID() };
    this.intents.push(stored);
    return stored;
  }
}

class InMemoryOrderRepository implements OrderRepository {
  readonly orders: StoredOrder[] = [];

  async getLatestOrderByExecutionIntentId(
    executionIntentId: string
  ): Promise<StoredOrder | null> {
    return (
      this.orders.filter((order) => order.executionIntentId === executionIntentId).at(-1) ??
      null
    );
  }

  async getOpenOrdersByTradingAccountIdAndSymbol(): Promise<StoredOrder[]> {
    return [];
  }

  async recordOrder(order: ReceivedOrder): Promise<StoredOrder> {
    const stored = { ...order, id: crypto.randomUUID() };
    this.orders.push(stored);
    return stored;
  }

  async updateOrderStatus(
    orderId: string,
    update: ReceivedOrderStatusUpdate
  ): Promise<StoredOrder> {
    const index = this.orders.findIndex((order) => order.id === orderId);
    if (index < 0) {
      throw new Error(`Unknown order: ${orderId}`);
    }
    const stored = { ...this.orders[index], ...update };
    this.orders[index] = stored;
    return stored;
  }
}

class InMemoryPositionRepository implements PositionRepository {
  async getCurrentPosition(): Promise<StoredPositionSnapshot | null> {
    return null;
  }

  async upsertCurrentPosition(
    position: ReceivedPositionSnapshot
  ): Promise<StoredPositionSnapshot> {
    return { ...position, id: crypto.randomUUID() };
  }

  async recordPositionHistory(
    entry: ReceivedPositionHistoryEntry
  ): Promise<StoredPositionHistoryEntry> {
    return { ...entry, id: crypto.randomUUID() };
  }
}

function buildStoredMarketState(rawPayload: typeof defaultReplayPlannerFixtures[number]["rawPayload"]): StoredMarketState {
  return {
    id: "ms-1",
    marketKey: `${rawPayload.context.market.tickerid}:${rawPayload.context.market.timeframe}`,
    webhookEventId: "wh-1",
    tickerid: rawPayload.context.market.tickerid,
    timeframe: rawPayload.context.market.timeframe,
    barTimeMs: rawPayload.context.bar.time_ms,
    context: rawPayload.context,
    createdAt: "2026-05-24T09:59:00.000Z"
  };
}
