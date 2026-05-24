import { describe, expect, it } from "vitest";
import {
  type AgentRunRepository,
  generateAndRecordTradePlanForSignal,
  type MarketStateRepository,
  type OrderRepository,
  type PositionRepository,
  type ReceivedAgentRun,
  type ReceivedMarketState,
  type ReceivedOrder,
  type ReceivedOrderStatusUpdate,
  type ReceivedPlanTransition,
  type ReceivedPositionHistoryEntry,
  type ReceivedPositionSnapshot,
  type ReceivedTradePlanVersion,
  type StoredMarketState,
  type StoredAgentRun,
  type StoredOrder,
  type StoredPlanTransition,
  type StoredPositionHistoryEntry,
  type StoredPositionSnapshot,
  type StoredTradePlanVersion,
  type TradePlanVersionRepository,
  type ReceivedWebhookEvent,
  type StoredWebhookEvent,
  type WebhookEventRepository
} from "../src/index.js";
import { ingestTradingViewPayload } from "../src/webhook-events/ingest-tradingview-payload.js";
import { contractFixture } from "./helpers.js";

class InMemoryWebhookEventRepository implements WebhookEventRepository {
  readonly events = new Map<string, StoredWebhookEvent>();

  async recordReceivedEvent(
    event: ReceivedWebhookEvent
  ): Promise<StoredWebhookEvent> {
    const stored = {
      ...event,
      id: crypto.randomUUID(),
      lastReceivedAt: event.receivedAt,
      deliveryCount: 1,
      duplicate: false,
      processStatus: "received"
    };
    this.events.set(event.deliveryKey, stored);
    return stored;
  }

  async updateProcessStatus(): Promise<void> {}
}

class InMemoryMarketStateRepository implements MarketStateRepository {
  readonly states: StoredMarketState[] = [];

  async recordMarketState(
    state: ReceivedMarketState
  ): Promise<StoredMarketState> {
    const stored = { ...state, id: crypto.randomUUID() };
    this.states.push(stored);
    return stored;
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
  readonly transitions: StoredPlanTransition[] = [];

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
    const stored = { ...transition, id: crypto.randomUUID() };
    this.transitions.push(stored);
    return stored;
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

class InMemoryOrderRepository implements OrderRepository {
  async getLatestOrderByExecutionIntentId(): Promise<StoredOrder | null> {
    return null;
  }

  async getOpenOrdersByTradingAccountIdAndSymbol(): Promise<StoredOrder[]> {
    return [];
  }

  async recordOrder(order: ReceivedOrder): Promise<StoredOrder> {
    return { ...order, id: crypto.randomUUID() };
  }

  async updateOrderStatus(
    orderId: string,
    update: ReceivedOrderStatusUpdate
  ): Promise<StoredOrder> {
    return {
      id: orderId,
      executionIntentId: "intent-1",
      tradingAccountId: "acct-1",
      venue: "paper",
      symbol: "BINANCE:BTCUSDT",
      side: "buy",
      orderType: "limit",
      timeInForce: "GTC",
      reduceOnly: false,
      clientOrderId: "client-1",
      exchangeOrderId: null,
      status: update.status,
      requestedQty: 0,
      requestedPrice: null,
      stopPrice: null,
      avgFillPrice: update.avgFillPrice,
      filledQty: update.filledQty,
      submittedAt: "2026-05-17T10:00:00.000Z",
      lastExchangeUpdateAt: update.lastExchangeUpdateAt,
      terminalAt: update.terminalAt,
      rawExchangeJson: update.rawExchangeJson
    };
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

describe("generateAndRecordTradePlanForSignal", () => {
  it("builds planner input, generates a plan, and persists the first version", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();
    const planRepository = new InMemoryTradePlanVersionRepository();
    const agentRunRepository = new InMemoryAgentRunRepository();
    const orderRepository = new InMemoryOrderRepository();
    const positionRepository = new InMemoryPositionRepository();
    const snapshot = contractFixture("snapshot.valid.json") as {
      context: ReceivedMarketState["context"];
    };

    await marketStateRepository.recordMarketState({
      marketKey: "BINANCE:BTCUSDT:240",
      webhookEventId: crypto.randomUUID(),
      tickerid: "BINANCE:BTCUSDT",
      timeframe: "240",
      barTimeMs: 1778419200000,
      context: snapshot.context,
      createdAt: "2026-05-17T10:00:00.000Z"
    });

    const ingestion = await ingestTradingViewPayload(
      contractFixture("signal.valid.json"),
      webhookRepository,
      "2026-05-17T10:01:00.000Z"
    );

    const result = await generateAndRecordTradePlanForSignal(
      ingestion.envelope,
      {
        marketStateRepository,
        tradePlanVersionRepository: planRepository,
        orderRepository,
        positionRepository,
        tradingAccountId: "acct-1"
      },
      planRepository,
      agentRunRepository
    );

    expect(result.tradePlan.action).toBe("create");
    expect(result.recordResult.tradePlanVersion.version).toBe(1);
    expect(result.recordResult.planTransition?.toState).toBe("armed");
    expect(agentRunRepository.runs).toHaveLength(1);
  });

  it("reuses the active plan id and emits a patch on subsequent aligned signals", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();
    const planRepository = new InMemoryTradePlanVersionRepository();
    const agentRunRepository = new InMemoryAgentRunRepository();
    const orderRepository = new InMemoryOrderRepository();
    const positionRepository = new InMemoryPositionRepository();
    const snapshot = contractFixture("snapshot.valid.json") as {
      context: ReceivedMarketState["context"];
    };

    await marketStateRepository.recordMarketState({
      marketKey: "BINANCE:BTCUSDT:240",
      webhookEventId: crypto.randomUUID(),
      tickerid: "BINANCE:BTCUSDT",
      timeframe: "240",
      barTimeMs: 1778419200000,
      context: snapshot.context,
      createdAt: "2026-05-17T10:00:00.000Z"
    });

    const first = await ingestTradingViewPayload(
      contractFixture("signal.valid.json"),
      webhookRepository
    );
    const firstResult = await generateAndRecordTradePlanForSignal(
      first.envelope,
      {
        marketStateRepository,
        tradePlanVersionRepository: planRepository,
        orderRepository,
        positionRepository,
        tradingAccountId: "acct-1"
      },
      planRepository,
      agentRunRepository
    );

    const second = await ingestTradingViewPayload(
      contractFixture("signal.valid.json"),
      webhookRepository
    );
    const secondResult = await generateAndRecordTradePlanForSignal(
      second.envelope,
      {
        marketStateRepository,
        tradePlanVersionRepository: planRepository,
        orderRepository,
        positionRepository,
        tradingAccountId: "acct-1"
      },
      planRepository,
      agentRunRepository
    );

    expect(secondResult.tradePlan.action).toBe("patch");
    expect(secondResult.recordResult.tradePlanVersion.planId).toBe(
      firstResult.recordResult.tradePlanVersion.planId
    );
    expect(secondResult.recordResult.tradePlanVersion.version).toBe(2);
    expect(agentRunRepository.runs).toHaveLength(2);
  });
});
