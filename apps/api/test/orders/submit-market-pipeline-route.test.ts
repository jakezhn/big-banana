import { describe, expect, it } from "vitest";
import type {
  MarketPipelineReadModel,
  MarketPipelineReadModelRepository,
  OrderRepository,
  ReceivedOrder,
  ReceivedOrderStatusUpdate,
  StoredOrder
} from "@big-banana/domain";
import { contractFixture } from "../../../../packages/domain/test/helpers.js";
import { handleSubmitMarketPipelineRequest } from "../../src/orders/handle-submit-market-pipeline-request.js";

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

  async getOpenOrdersByTradingAccountIdAndSymbol(
    tradingAccountId: string,
    symbol: string
  ): Promise<StoredOrder[]> {
    return this.orders.filter(
      (order) =>
        order.tradingAccountId === tradingAccountId &&
        order.symbol === symbol &&
        order.terminalAt === null &&
        order.status !== "preflight_failed" &&
        order.status !== "rejected"
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

function request(marketKey?: string): Request {
  const suffix = marketKey
    ? `?market_key=${encodeURIComponent(marketKey)}`
    : "";

  return new Request(
    `http://localhost/api/market-pipeline/submit${suffix}`,
    { method: "POST" }
  );
}

function intentReadySnapshot(): MarketPipelineReadModel {
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
    latestOrder: null,
    latestFill: null,
    currentPosition: null
  };
}

describe("POST /api/market-pipeline/submit", () => {
  it("submits a paper order for an intent-ready market pipeline", async () => {
    const orderRepository = new InMemoryOrderRepository();
    const response = await handleSubmitMarketPipelineRequest(
      request("BINANCE:BTCUSDT:240"),
      new InMemoryMarketPipelineReadModelRepository({
        "BINANCE:BTCUSDT:240": intentReadySnapshot()
      }),
      orderRepository
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "submitted",
      pipeline_status: "order_submitted",
      order_id: orderRepository.orders[0]?.id
    });
    expect(orderRepository.orders[0]?.status).toBe("acked");
  });

  it("returns already_submitted when an order already exists", async () => {
    const orderRepository = new InMemoryOrderRepository();
    orderRepository.orders.push({
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
      submittedAt: "2026-05-18T00:03:00.000Z",
      lastExchangeUpdateAt: "2026-05-18T00:03:00.000Z",
      terminalAt: null,
      rawExchangeJson: {}
    });

    const response = await handleSubmitMarketPipelineRequest(
      request("BINANCE:BTCUSDT:240"),
      new InMemoryMarketPipelineReadModelRepository({
        "BINANCE:BTCUSDT:240": intentReadySnapshot()
      }),
      orderRepository
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "already_submitted",
      pipeline_status: "order_submitted",
      order_id: "order-1"
    });
  });

  it("rejects submission when execution intent is missing", async () => {
    const response = await handleSubmitMarketPipelineRequest(
      request("BINANCE:BTCUSDT:240"),
      new InMemoryMarketPipelineReadModelRepository({
        "BINANCE:BTCUSDT:240": {
          ...intentReadySnapshot(),
          executionIntent: null
        }
      }),
      new InMemoryOrderRepository()
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "intent_not_ready"
    });
  });
});
