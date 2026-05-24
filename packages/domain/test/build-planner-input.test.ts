import { describe, expect, it } from "vitest";
import { buildPlannerInput, SignalPlannerInputError } from "../src/planner/build-planner-input.js";
import type {
  MarketStateRepository,
  ReceivedMarketState,
  StoredMarketState
} from "../src/market-state/market-state-repository.js";
import type {
  OrderRepository,
  ReceivedOrder,
  ReceivedOrderStatusUpdate,
  StoredOrder
} from "../src/orders/order-repository.js";
import type {
  PositionRepository,
  ReceivedPositionHistoryEntry,
  ReceivedPositionSnapshot,
  StoredPositionHistoryEntry,
  StoredPositionSnapshot
} from "../src/positions/position-repository.js";
import type {
  ReceivedPlanTransition,
  ReceivedTradePlanVersion,
  StoredPlanTransition,
  StoredTradePlanVersion,
  TradePlanVersionRepository
} from "../src/plans/trade-plan-version-repository.js";
import { ingestTradingViewPayload } from "../src/webhook-events/ingest-tradingview-payload.js";
import type {
  ReceivedWebhookEvent,
  StoredWebhookEvent,
  WebhookEventRepository
} from "../src/webhook-events/webhook-event-repository.js";
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
    const stored = {
      ...state,
      id: crypto.randomUUID()
    };
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
  constructor(
    private readonly latestByMarketKey: StoredTradePlanVersion | null = null
  ) {}

  async getLatestTradePlanVersion(): Promise<StoredTradePlanVersion | null> {
    return null;
  }

  async getLatestTradePlanVersionByMarketKey(): Promise<StoredTradePlanVersion | null> {
    return this.latestByMarketKey;
  }

  async recordTradePlanVersion(
    version: ReceivedTradePlanVersion
  ): Promise<StoredTradePlanVersion> {
    return { ...version, id: crypto.randomUUID() };
  }

  async recordPlanTransition(
    transition: ReceivedPlanTransition
  ): Promise<StoredPlanTransition> {
    return { ...transition, id: crypto.randomUUID() };
  }
}

class InMemoryOrderRepository implements OrderRepository {
  constructor(private readonly openOrders: StoredOrder[] = []) {}

  async getLatestOrderByExecutionIntentId(): Promise<StoredOrder | null> {
    return null;
  }

  async getOpenOrdersByTradingAccountIdAndSymbol(): Promise<StoredOrder[]> {
    return this.openOrders;
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
  constructor(private readonly currentPosition: StoredPositionSnapshot | null = null) {}

  async getCurrentPosition(): Promise<StoredPositionSnapshot | null> {
    return this.currentPosition;
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

describe("buildPlannerInput", () => {
  it("builds minimal planner input from a signal and latest stored snapshots", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();
    const tradePlanVersionRepository = new InMemoryTradePlanVersionRepository();
    const orderRepository = new InMemoryOrderRepository();
    const positionRepository = new InMemoryPositionRepository();

    await marketStateRepository.recordMarketState({
      marketKey: "BINANCE:BTCUSDT:240",
      webhookEventId: crypto.randomUUID(),
      tickerid: "BINANCE:BTCUSDT",
      timeframe: "240",
      barTimeMs: 1778419200000,
      context: (contractFixture("snapshot.valid.json") as {
        context: ReceivedMarketState["context"];
      }).context,
      createdAt: "2026-05-17T10:00:00.000Z"
    });

    const ingestion = await ingestTradingViewPayload(
      contractFixture("signal.valid.json"),
      webhookRepository,
      "2026-05-17T10:01:00.000Z"
    );

    const plannerInput = await buildPlannerInput(
      ingestion.envelope,
      {
        marketStateRepository,
        tradePlanVersionRepository,
        orderRepository,
        positionRepository,
        tradingAccountId: "acct-1"
      }
    );

    expect(plannerInput.signal).toMatchObject({
      direction: "long",
      rankLevel: 4,
      rankPct: 0.83,
      proposedSize: 0.72,
      regimeAlignment: "align"
    });
    expect(plannerInput.state.latestSnapshots["BINANCE:BTCUSDT:240"]).toMatchObject({
      market: {
        timeframe: "240"
      }
    });
    expect(plannerInput.state.recentSnapshots).toHaveLength(1);
    expect(plannerInput.state.windowSummary.snapshotCount).toBe(1);
    expect(plannerInput.state.activePlan).toBeNull();
    expect(plannerInput.state.openOrders).toEqual([]);
    expect(plannerInput.state.openPosition).toBeNull();
  });

  it("rejects snapshot payloads", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();
    const tradePlanVersionRepository = new InMemoryTradePlanVersionRepository();
    const orderRepository = new InMemoryOrderRepository();
    const positionRepository = new InMemoryPositionRepository();
    const ingestion = await ingestTradingViewPayload(
      contractFixture("snapshot.valid.json"),
      webhookRepository,
      "2026-05-17T10:00:00.000Z"
    );

    await expect(
      buildPlannerInput(ingestion.envelope, {
        marketStateRepository,
        tradePlanVersionRepository,
        orderRepository,
        positionRepository,
        tradingAccountId: "acct-1"
      })
    ).rejects.toBeInstanceOf(SignalPlannerInputError);
  });

  it("includes recent window state plus active plan, position, and open orders", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();
    const snapshot = contractFixture("snapshot.valid.json") as {
      context: ReceivedMarketState["context"];
    };

    await marketStateRepository.recordMarketState({
      marketKey: "BINANCE:BTCUSDT:240",
      webhookEventId: crypto.randomUUID(),
      tickerid: "BINANCE:BTCUSDT",
      timeframe: "240",
      barTimeMs: 1778419200000,
      context: {
        ...snapshot.context,
        bar: { ...snapshot.context.bar, close: 65000, high: 65200, low: 64500 },
        regime: { ...snapshot.context.regime, name: "compression" },
        momentum: { ...snapshot.context.momentum, direction: "bull" },
        osc: { ...snapshot.context.osc, direction: "bull" }
      },
      createdAt: "2026-05-17T10:00:00.000Z"
    });
    await marketStateRepository.recordMarketState({
      marketKey: "BINANCE:BTCUSDT:240",
      webhookEventId: crypto.randomUUID(),
      tickerid: "BINANCE:BTCUSDT",
      timeframe: "240",
      barTimeMs: 1778422800000,
      context: {
        ...snapshot.context,
        bar: { ...snapshot.context.bar, close: 67000, high: 67200, low: 64800 },
        regime: { ...snapshot.context.regime, name: "trend" },
        momentum: { ...snapshot.context.momentum, direction: "bull" },
        osc: { ...snapshot.context.osc, direction: "bull" }
      },
      createdAt: "2026-05-17T11:00:00.000Z"
    });

    const activePlan = {
      id: "plan-version-1",
      planId: "plan-1",
      version: 3,
      marketKey: "BINANCE:BTCUSDT:240",
      sourceEventKey: "event-1",
      action: "patch" as const,
      marketThesis: (contractFixture("trade-plan.valid.json") as any).market_thesis,
      executionPlaybook: {
        ...(contractFixture("trade-plan.valid.json") as any).execution_playbook,
        state: "armed"
      },
      riskIntent: (contractFixture("trade-plan.valid.json") as any).risk_intent,
      reasoningSummary: "Existing active plan",
      evidence: ["existing_plan"],
      createdAt: "2026-05-17T11:30:00.000Z"
    } satisfies StoredTradePlanVersion;
    const openOrder = {
      id: "order-1",
      executionIntentId: "intent-1",
      tradingAccountId: "acct-1",
      venue: "paper",
      symbol: "BINANCE:BTCUSDT",
      side: "buy" as const,
      orderType: "limit" as const,
      timeInForce: "GTC" as const,
      reduceOnly: false,
      clientOrderId: "client-1",
      exchangeOrderId: null,
      status: "acked" as const,
      requestedQty: 0.18,
      requestedPrice: 66950,
      stopPrice: 66240,
      avgFillPrice: null,
      filledQty: 0,
      submittedAt: "2026-05-17T11:35:00.000Z",
      lastExchangeUpdateAt: "2026-05-17T11:35:00.000Z",
      terminalAt: null,
      rawExchangeJson: { mode: "paper" }
    } satisfies StoredOrder;
    const openPosition = {
      id: "position-1",
      tradingAccountId: "acct-1",
      symbol: "BINANCE:BTCUSDT",
      marketKey: "BINANCE:BTCUSDT:240",
      positionSide: "long" as const,
      signedQty: 0.18,
      avgEntryPrice: 66880,
      openedAt: "2026-05-17T11:36:00.000Z",
      closedAt: null,
      updatedAt: "2026-05-17T11:36:00.000Z",
      lastFillId: "fill-1"
    } satisfies StoredPositionSnapshot;

    const ingestion = await ingestTradingViewPayload(
      contractFixture("signal.valid.json"),
      webhookRepository,
      "2026-05-17T12:00:00.000Z"
    );

    const plannerInput = await buildPlannerInput(ingestion.envelope, {
      marketStateRepository,
      tradePlanVersionRepository: new InMemoryTradePlanVersionRepository(activePlan),
      orderRepository: new InMemoryOrderRepository([openOrder]),
      positionRepository: new InMemoryPositionRepository(openPosition),
      tradingAccountId: "acct-1",
      recentSnapshotWindow: 5
    });

    expect(plannerInput.state.recentSnapshots.map((snapshot) => snapshot.barTimeMs)).toEqual([
      1778419200000,
      1778422800000
    ]);
    expect(plannerInput.state.windowSummary.snapshotCount).toBe(2);
    expect(plannerInput.state.windowSummary.netDirection).toBe("bull");
    expect(plannerInput.state.activePlan?.planId).toBe("plan-1");
    expect(plannerInput.state.openOrders).toHaveLength(1);
    expect(plannerInput.state.openPosition?.positionSide).toBe("long");
  });
});
