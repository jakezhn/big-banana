import { describe, expect, it } from "vitest";
import type {
  ExecutionIntentRepository,
  MarketPipelineReadModel,
  MarketPipelineReadModelRepository,
  OrderRepository,
  ReceivedExecutionIntent,
  ReceivedOrder,
  ReceivedOrderStatusUpdate,
  StoredExecutionIntent,
  StoredOrder
} from "@big-banana/domain";
import { contractFixture } from "../../../../packages/domain/test/helpers.js";
import { handleInterveneMarketPipelineRequest } from "../../src/interventions/handle-intervene-market-pipeline-request.js";

class InMemoryMarketPipelineReadModelRepository
  implements MarketPipelineReadModelRepository
{
  constructor(
    private readonly snapshots: Record<string, MarketPipelineReadModel> = {}
  ) {}

  async getLatestMarketPipeline(
    marketKey: string
  ): Promise<MarketPipelineReadModel | null> {
    return this.snapshots[marketKey] ?? null;
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

  constructor(initialOrders: StoredOrder[] = []) {
    this.orders.push(...initialOrders);
  }

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

function request(
  action: "cancel_pending_entry" | "flatten_position",
  marketKey = "BINANCE:BTCUSDT:240"
): Request {
  return new Request(
    `http://localhost/api/market-pipeline/intervene?market_key=${encodeURIComponent(
      marketKey
    )}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action })
    }
  );
}

function baseSnapshot(order: StoredOrder): MarketPipelineReadModel {
  const tradePlan = contractFixture("trade-plan.valid.json") as Record<
    string,
    any
  >;

  return {
    marketKey: "BINANCE:BTCUSDT:240",
    marketState: null,
    tradePlanVersion: {
      id: "plan-version-1",
      planId: "plan-1",
      version: 1,
      marketKey: "BINANCE:BTCUSDT:240",
      sourceEventKey: "event-1",
      action: tradePlan.action,
      marketThesis: tradePlan.market_thesis,
      executionPlaybook: tradePlan.execution_playbook,
      riskIntent: tradePlan.risk_intent,
      reasoningSummary: tradePlan.reasoning_summary,
      evidence: tradePlan.evidence,
      createdAt: "2026-05-18T00:00:00.000Z"
    },
    riskVerdict: {
      id: "risk-1",
      tradePlanVersionId: "plan-version-1",
      tradingAccountId: "acct-1",
      verdict: "approve_with_reduction",
      approvedRiskPct: 0.35,
      approvedQty: 0.18,
      approvedNotional: 12132,
      approvedStopPrice: 66240,
      requireHumanApproval: false,
      checks: [],
      rejectionCodes: [],
      createdAt: "2026-05-18T00:01:00.000Z"
    },
    executionIntent: {
      id: "intent-1",
      tradePlanVersionId: "plan-version-1",
      riskVerdictId: "risk-1",
      tradingAccountId: "acct-1",
      payload: {
        action: "open",
        plan_version_id: "plan-version-1",
        trading_account_id: "acct-1",
        symbol: "BTCUSDT",
        side: "buy",
        order_type: "limit",
        time_in_force: "GTC",
        qty: 0.18,
        price: 66950,
        stop_price: 66240,
        reduce_only: false,
        client_order_id: "BTCUSDT-buy-v1",
        idempotency_key: "plan-version-1:risk-1:open"
      },
      createdAt: "2026-05-18T00:02:00.000Z"
    },
    latestOrder: order
  };
}

function ackedOrder(): StoredOrder {
  return {
    id: "order-1",
    executionIntentId: "intent-1",
    tradingAccountId: "acct-1",
    venue: "paper",
    symbol: "BTCUSDT",
    side: "buy",
    orderType: "limit",
    timeInForce: "GTC",
    reduceOnly: false,
    clientOrderId: "BTCUSDT-buy-v1",
    exchangeOrderId: "paper-1",
    status: "acked",
    requestedQty: 0.18,
    requestedPrice: 66950,
    stopPrice: 66240,
    avgFillPrice: null,
    filledQty: 0,
    submittedAt: "2026-05-19T00:00:00.000Z",
    lastExchangeUpdateAt: "2026-05-19T00:00:00.000Z",
    terminalAt: null,
    rawExchangeJson: { mode: "paper", acknowledged: true }
  };
}

function filledOrder(): StoredOrder {
  return {
    ...ackedOrder(),
    status: "filled",
    avgFillPrice: 66950,
    filledQty: 0.18,
    terminalAt: "2026-05-19T00:05:00.000Z"
  };
}

describe("POST /api/market-pipeline/intervene", () => {
  it("cancels a pending entry order", async () => {
    const orderRepository = new InMemoryOrderRepository([ackedOrder()]);
    const response = await handleInterveneMarketPipelineRequest(
      request("cancel_pending_entry"),
      new InMemoryMarketPipelineReadModelRepository({
        "BINANCE:BTCUSDT:240": baseSnapshot(ackedOrder())
      }),
      new InMemoryExecutionIntentRepository(),
      orderRepository
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      action: "cancel_pending_entry",
      pipeline_status: "order_terminal",
      order_id: "order-1",
      order_state: "canceled"
    });
  });

  it("submits a reduce-only close order to flatten a filled position", async () => {
    const executionIntentRepository = new InMemoryExecutionIntentRepository();
    const orderRepository = new InMemoryOrderRepository();
    const response = await handleInterveneMarketPipelineRequest(
      request("flatten_position"),
      new InMemoryMarketPipelineReadModelRepository({
        "BINANCE:BTCUSDT:240": baseSnapshot(filledOrder())
      }),
      executionIntentRepository,
      orderRepository
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      action: "flatten_position",
      pipeline_status: "order_submitted",
      execution_intent_id: executionIntentRepository.intents[0]?.id,
      order_id: orderRepository.orders[0]?.id,
      order_state: "acked"
    });
    expect(executionIntentRepository.intents[0]?.payload.action).toBe("close");
    expect(executionIntentRepository.intents[0]?.payload.reduce_only).toBe(true);
  });
});
