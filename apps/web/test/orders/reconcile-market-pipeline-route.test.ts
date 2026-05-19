import { describe, expect, it } from "vitest";
import type {
  MarketPipelineReadModel,
  MarketPipelineReadModelRepository,
  OrderRepository,
  ReceivedOrder,
  ReceivedOrderStatusUpdate,
  StoredOrder
} from "@big-banana/domain";
import { handleReconcileMarketPipelineRequest } from "../../src/orders/handle-reconcile-market-pipeline-request.js";

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
  readonly orders = new Map<string, StoredOrder>();

  constructor(initialOrders: StoredOrder[] = []) {
    for (const order of initialOrders) {
      this.orders.set(order.id, order);
    }
  }

  async getLatestOrderByExecutionIntentId(
    executionIntentId: string
  ): Promise<StoredOrder | null> {
    return (
      [...this.orders.values()]
        .filter((order) => order.executionIntentId === executionIntentId)
        .at(-1) ?? null
    );
  }

  async recordOrder(order: ReceivedOrder): Promise<StoredOrder> {
    const stored = { ...order, id: crypto.randomUUID() };
    this.orders.set(stored.id, stored);
    return stored;
  }

  async updateOrderStatus(
    orderId: string,
    update: ReceivedOrderStatusUpdate
  ): Promise<StoredOrder> {
    const existing = this.orders.get(orderId);

    if (!existing) {
      throw new Error(`Unknown order: ${orderId}`);
    }

    const stored = {
      ...existing,
      ...update
    };
    this.orders.set(orderId, stored);
    return stored;
  }
}

function request(
  marketKey?: string,
  outcome?: "filled" | "canceled" | "bogus"
): Request {
  const url = new URL("http://localhost/api/market-pipeline/reconcile");

  if (marketKey) {
    url.searchParams.set("market_key", marketKey);
  }

  if (outcome) {
    url.searchParams.set("outcome", outcome);
  }

  return new Request(url, { method: "POST" });
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

function snapshotWithOrder(order: StoredOrder): MarketPipelineReadModel {
  return {
    marketKey: "BINANCE:BTCUSDT:240",
    marketState: null,
    tradePlanVersion: null,
    riskVerdict: null,
    executionIntent: null,
    latestOrder: order
  };
}

describe("POST /api/market-pipeline/reconcile", () => {
  it("reconciles an acked paper order to filled", async () => {
    const order = ackedOrder();
    const orderRepository = new InMemoryOrderRepository([order]);
    const response = await handleReconcileMarketPipelineRequest(
      request("BINANCE:BTCUSDT:240", "filled"),
      new InMemoryMarketPipelineReadModelRepository({
        "BINANCE:BTCUSDT:240": snapshotWithOrder(order)
      }),
      orderRepository
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "reconciled",
      pipeline_status: "order_terminal",
      order_id: "order-1",
      order_state: "filled"
    });
    expect(orderRepository.orders.get("order-1")?.status).toBe("filled");
  });

  it("reconciles an acked paper order to canceled", async () => {
    const order = ackedOrder();
    const orderRepository = new InMemoryOrderRepository([order]);
    const response = await handleReconcileMarketPipelineRequest(
      request("BINANCE:BTCUSDT:240", "canceled"),
      new InMemoryMarketPipelineReadModelRepository({
        "BINANCE:BTCUSDT:240": snapshotWithOrder(order)
      }),
      orderRepository
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "reconciled",
      pipeline_status: "order_terminal",
      order_id: "order-1",
      order_state: "canceled"
    });
  });

  it("rejects invalid outcomes", async () => {
    const order = ackedOrder();
    const response = await handleReconcileMarketPipelineRequest(
      request("BINANCE:BTCUSDT:240", "bogus"),
      new InMemoryMarketPipelineReadModelRepository({
        "BINANCE:BTCUSDT:240": snapshotWithOrder(order)
      }),
      new InMemoryOrderRepository([order])
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "invalid_outcome"
    });
  });

  it("rejects already terminal orders", async () => {
    const order = {
      ...ackedOrder(),
      status: "filled" as const,
      terminalAt: "2026-05-19T00:05:00.000Z"
    };
    const response = await handleReconcileMarketPipelineRequest(
      request("BINANCE:BTCUSDT:240", "filled"),
      new InMemoryMarketPipelineReadModelRepository({
        "BINANCE:BTCUSDT:240": snapshotWithOrder(order)
      }),
      new InMemoryOrderRepository([order])
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "already_terminal"
    });
  });
});
