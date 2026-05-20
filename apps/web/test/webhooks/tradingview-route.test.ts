import { describe, expect, it } from "vitest";
import { contractFixture } from "../../../../packages/domain/test/helpers.js";
import {
  type ExecutionIntentRepository,
  type MarketStateRepository,
  type OrderRepository,
  type ReceivedOrder,
  type ReceivedOrderStatusUpdate,
  type ReceivedExecutionIntent,
  type ReceivedMarketState,
  type ReceivedPlanTransition,
  type ReceivedRiskVerdict,
  type ReceivedTradePlanVersion,
  type ReceivedWebhookEvent,
  type RiskPolicySnapshot,
  type RiskVerdictRepository,
  type StoredExecutionIntent,
  type StoredMarketState,
  type StoredOrder,
  type StoredPlanTransition,
  type StoredRiskVerdict,
  type StoredTradePlanVersion,
  type StoredWebhookEvent,
  type TradePlanVersionRepository,
  type WebhookEventRepository
} from "@big-banana/domain";
import { handleTradingViewWebhookRequest } from "../../src/webhooks/tradingview/handle-tradingview-webhook-request.js";

function request(body: string, contentType = "application/json"): Request {
  return new Request("http://localhost/api/webhooks/tradingview", {
    method: "POST",
    headers: {
      "content-type": contentType
    },
    body
  });
}

const manualReviewPolicy: RiskPolicySnapshot = {
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

class InMemoryWebhookEventRepository implements WebhookEventRepository {
  readonly events = new Map<string, StoredWebhookEvent>();

  async recordReceivedEvent(
    event: ReceivedWebhookEvent
  ): Promise<StoredWebhookEvent> {
    const existing = this.events.get(event.deliveryKey);

    if (existing) {
      const duplicate = {
        ...existing,
        lastReceivedAt: event.receivedAt,
        deliveryCount: existing.deliveryCount + 1,
        duplicate: true
      };

      this.events.set(event.deliveryKey, duplicate);
      return duplicate;
    }

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

  async updateProcessStatus(
    webhookEventId: string,
    processStatus: string
  ): Promise<void> {
    for (const [deliveryKey, event] of this.events.entries()) {
      if (event.id !== webhookEventId) {
        continue;
      }

      this.events.set(deliveryKey, { ...event, processStatus });
      return;
    }

    throw new Error(`Unknown webhook event: ${webhookEventId}`);
  }
}

class InMemoryMarketStateRepository implements MarketStateRepository {
  readonly states = new Map<string, StoredMarketState>();

  async recordMarketState(
    state: ReceivedMarketState
  ): Promise<StoredMarketState> {
    const existing = this.states.get(state.marketKey);
    const stored = {
      ...state,
      id: existing?.id ?? crypto.randomUUID()
    };

    if (!existing || state.barTimeMs >= existing.barTimeMs) {
      this.states.set(state.marketKey, stored);
    }

    return this.states.get(state.marketKey) as StoredMarketState;
  }

  async getLatestStatesByTickerid(tickerid: string): Promise<StoredMarketState[]> {
    return [...this.states.values()].filter((state) => state.tickerid === tickerid);
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
  readonly orders: StoredOrder[] = [];

  async getLatestOrderByExecutionIntentId(
    executionIntentId: string
  ): Promise<StoredOrder | null> {
    return (
      this.orders
        .filter((order) => order.executionIntentId === executionIntentId)
        .at(-1) ?? null
    );
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

    const stored = {
      ...this.orders[index],
      ...update
    };
    this.orders[index] = stored;
    return stored;
  }
}

function dependencies(
  overrides?: Partial<{
    riskPolicy: RiskPolicySnapshot;
  }>
) {
  return {
    webhookEventRepository: new InMemoryWebhookEventRepository(),
    marketStateRepository: new InMemoryMarketStateRepository(),
    tradePlanVersionRepository: new InMemoryTradePlanVersionRepository(),
    riskVerdictRepository: new InMemoryRiskVerdictRepository(),
    executionIntentRepository: new InMemoryExecutionIntentRepository(),
    orderRepository: new InMemoryOrderRepository(),
    riskPolicy: overrides?.riskPolicy ?? manualReviewPolicy
  };
}

describe("POST /api/webhooks/tradingview", () => {
  it("accepts a valid snapshot payload and stores a normalized market state", async () => {
    const deps = dependencies();
    const response = await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("snapshot.valid.json"))),
      deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      event_key: "BINANCE:BTCUSDT:240:1778419200000:snapshot",
      duplicate: false,
      process_status: "normalized"
    });
    expect([...deps.webhookEventRepository.events.values()][0]?.processStatus).toBe(
      "normalized"
    );
    expect(deps.tradePlanVersionRepository.versions.size).toBe(0);
  });

  it("processes a valid signal payload through plan, risk, intent, and auto-submit by default", async () => {
    const deps = dependencies();
    await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("snapshot.valid.json"))),
      deps
    );

    const response = await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("signal.valid.json"))),
      deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      event_key: "BINANCE:BTCUSDT:240:1778404800000:signal",
      duplicate: false,
      process_status: "order_submitted"
    });
    expect([...deps.tradePlanVersionRepository.versions.values()].flat()).toHaveLength(1);
    expect(deps.riskVerdictRepository.verdicts).toHaveLength(1);
    expect(deps.executionIntentRepository.intents).toHaveLength(1);
    expect(deps.orderRepository.orders).toHaveLength(1);
  });

  it("marks a repeated signal delivery as duplicate without replaying downstream writes", async () => {
    const deps = dependencies();
    await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("snapshot.valid.json"))),
      deps
    );

    const body = JSON.stringify(contractFixture("signal.valid.json"));
    await handleTradingViewWebhookRequest(request(body), deps);
    const response = await handleTradingViewWebhookRequest(request(body), deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      event_key: "BINANCE:BTCUSDT:240:1778404800000:signal",
      duplicate: true,
      process_status: "order_submitted"
    });
    expect([...deps.tradePlanVersionRepository.versions.values()].flat()).toHaveLength(1);
    expect(deps.riskVerdictRepository.verdicts).toHaveLength(1);
    expect(deps.executionIntentRepository.intents).toHaveLength(1);
    expect(deps.orderRepository.orders).toHaveLength(1);
  });

  it("ignores the deprecated manual-review flag and still auto-submits", async () => {
    const deps = dependencies({
      riskPolicy: {
        ...manualReviewPolicy,
        liveRequiresManualApproval: true
      }
    });
    await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("snapshot.valid.json"))),
      deps
    );

    const response = await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("signal.valid.json"))),
      deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      event_key: "BINANCE:BTCUSDT:240:1778404800000:signal",
      duplicate: false,
      process_status: "order_submitted"
    });
    expect(deps.executionIntentRepository.intents).toHaveLength(1);
    expect(deps.orderRepository.orders).toHaveLength(1);
  });

  it("rejects non-json content types", async () => {
    const response = await handleTradingViewWebhookRequest(
      request("{}", "text/plain"),
      dependencies()
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      accepted: false,
      error: "invalid_content_type"
    });
  });

  it("rejects malformed json", async () => {
    const response = await handleTradingViewWebhookRequest(
      request("{"),
      dependencies()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      accepted: false,
      error: "invalid_json"
    });
  });

  it("rejects invalid payloads", async () => {
    const response = await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("unknown-version.invalid.json"))),
      dependencies()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      accepted: false,
      error: "invalid_payload"
    });
  });
});
