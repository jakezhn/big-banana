import { describe, expect, it } from "vitest";
import type {
  OrderRepository,
  ReceivedOrder,
  ReceivedOrderStatusUpdate,
  StoredOrder
} from "../src/index.js";
import { reconcilePaperOrder } from "../src/index.js";

class InMemoryOrderRepository implements OrderRepository {
  private order: StoredOrder;

  constructor(order: StoredOrder) {
    this.order = order;
  }

  async getLatestOrderByExecutionIntentId(): Promise<StoredOrder | null> {
    return this.order;
  }

  async getOpenOrdersByTradingAccountIdAndSymbol(): Promise<StoredOrder[]> {
    return this.order.terminalAt === null ? [this.order] : [];
  }

  async recordOrder(order: ReceivedOrder): Promise<StoredOrder> {
    const stored = { ...order, id: crypto.randomUUID() };
    this.order = stored;
    return stored;
  }

  async updateOrderStatus(
    orderId: string,
    update: ReceivedOrderStatusUpdate
  ): Promise<StoredOrder> {
    if (orderId !== this.order.id) {
      throw new Error(`Unknown order: ${orderId}`);
    }

    this.order = {
      ...this.order,
      ...update
    };
    return this.order;
  }
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

describe("reconcilePaperOrder", () => {
  it("reconciles an acked order to filled", async () => {
    const repository = new InMemoryOrderRepository(ackedOrder());
    const order = await reconcilePaperOrder(
      ackedOrder(),
      "filled",
      repository,
      "2026-05-19T00:10:00.000Z"
    );

    expect(order.status).toBe("filled");
    expect(order.avgFillPrice).toBe(66950);
    expect(order.filledQty).toBe(0.18);
    expect(order.terminalAt).toBe("2026-05-19T00:10:00.000Z");
  });

  it("reconciles an acked order to canceled", async () => {
    const repository = new InMemoryOrderRepository(ackedOrder());
    const order = await reconcilePaperOrder(
      ackedOrder(),
      "canceled",
      repository,
      "2026-05-19T00:10:00.000Z"
    );

    expect(order.status).toBe("canceled");
    expect(order.filledQty).toBe(0);
    expect(order.terminalAt).toBe("2026-05-19T00:10:00.000Z");
  });
});
