import { describe, expect, it } from "vitest";
import {
  ingestTradingViewPayload,
  type OrderRepository,
  type PositionRepository,
  processDeterministicSignalPipeline,
  type AgentRunRepository,
  type ReceivedAgentRun,
  type ExecutionIntentRepository,
  type MarketStateRepository,
  type ReceivedExecutionIntent,
  type ReceivedMarketState,
  type ReceivedOrder,
  type ReceivedOrderStatusUpdate,
  type ReceivedPlanTransition,
  type ReceivedPositionHistoryEntry,
  type ReceivedPositionSnapshot,
  type ReceivedRiskVerdict,
  type ReceivedTradePlanVersion,
  type ReceivedWebhookEvent,
  type RiskPolicySnapshot,
  type RiskVerdictRepository,
  type StoredExecutionIntent,
  type StoredAgentRun,
  type StoredMarketState,
  type StoredOrder,
  type StoredPlanTransition,
  type StoredPositionHistoryEntry,
  type StoredPositionSnapshot,
  type StoredRiskVerdict,
  type StoredTradePlanVersion,
  type StoredWebhookEvent,
  type TradePlanVersionRepository,
  type WebhookEventRepository
} from "../src/index.js";
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

class InMemoryAgentRunRepository implements AgentRunRepository {
  readonly runs: StoredAgentRun[] = [];

  async recordAgentRun(run: ReceivedAgentRun): Promise<StoredAgentRun> {
    const stored = { ...run, id: crypto.randomUUID() };
    this.runs.push(stored);
    return stored;
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

const baseRiskPolicy: RiskPolicySnapshot = {
  tradingAccountId: "acct-1",
  accountEquity: 20000,
  maxTradeRiskPct: 0.5,
  maxNotional: 100000,
  maxLeverage: 3,
  dailyLossLimitBreached: false,
  consecutiveLossLimitBreached: false,
  killSwitchEnabled: false,
  liveRequiresManualApproval: false
};

async function seedMarketState(repository: MarketStateRepository): Promise<void> {
  const snapshot = contractFixture("snapshot.valid.json") as {
    context: ReceivedMarketState["context"];
  };

  await repository.recordMarketState({
    marketKey: "BINANCE:BTCUSDT:240",
    webhookEventId: crypto.randomUUID(),
    tickerid: "BINANCE:BTCUSDT",
    timeframe: "240",
    barTimeMs: 1778419200000,
    context: snapshot.context,
    createdAt: "2026-05-17T10:00:00.000Z"
  });
}

async function ingestSignal(repository: WebhookEventRepository) {
  return ingestTradingViewPayload(
    contractFixture("signal.valid.json"),
    repository,
    "2026-05-17T10:01:00.000Z"
  );
}

describe("processDeterministicSignalPipeline", () => {
  it("persists a plan, risk verdict, and execution intent for auto-approved flow", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();
    const tradePlanVersionRepository = new InMemoryTradePlanVersionRepository();
    const agentRunRepository = new InMemoryAgentRunRepository();
    const riskVerdictRepository = new InMemoryRiskVerdictRepository();
    const executionIntentRepository = new InMemoryExecutionIntentRepository();
    const orderRepository = new InMemoryOrderRepository();
    const positionRepository = new InMemoryPositionRepository();
    await seedMarketState(marketStateRepository);
    const ingestion = await ingestSignal(webhookRepository);

    const result = await processDeterministicSignalPipeline(
      ingestion.envelope,
      baseRiskPolicy,
      {
        marketStateRepository,
        tradePlanVersionRepository,
        orderRepository,
        positionRepository,
        tradingAccountId: "acct-1",
        agentRunRepository,
        riskVerdictRepository,
        executionIntentRepository
      },
      "2026-05-17T10:02:00.000Z"
    );

    expect(result.plan.recordResult.tradePlanVersion.version).toBe(1);
    expect(result.riskVerdict.verdict).toBe("approve_with_reduction");
    expect(result.executionIntent?.payload.action).toBe("open");
    expect(agentRunRepository.runs).toHaveLength(1);
    expect(agentRunRepository.runs[0]?.status).toBe("success");
    expect(riskVerdictRepository.verdicts).toHaveLength(1);
    expect(executionIntentRepository.intents).toHaveLength(1);
  });

  it("continues to execution intent even when the deprecated manual-approval flag is set", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();
    const tradePlanVersionRepository = new InMemoryTradePlanVersionRepository();
    const agentRunRepository = new InMemoryAgentRunRepository();
    const riskVerdictRepository = new InMemoryRiskVerdictRepository();
    const executionIntentRepository = new InMemoryExecutionIntentRepository();
    const orderRepository = new InMemoryOrderRepository();
    const positionRepository = new InMemoryPositionRepository();
    await seedMarketState(marketStateRepository);
    const ingestion = await ingestSignal(webhookRepository);

    const result = await processDeterministicSignalPipeline(
      ingestion.envelope,
      {
        ...baseRiskPolicy,
        liveRequiresManualApproval: true
      },
      {
        marketStateRepository,
        tradePlanVersionRepository,
        orderRepository,
        positionRepository,
        tradingAccountId: "acct-1",
        agentRunRepository,
        riskVerdictRepository,
        executionIntentRepository
      }
    );

    expect(result.riskVerdict.requireHumanApproval).toBe(false);
    expect(result.executionIntent?.payload.action).toBe("open");
    expect(agentRunRepository.runs).toHaveLength(1);
    expect(executionIntentRepository.intents).toHaveLength(1);
  });
});
