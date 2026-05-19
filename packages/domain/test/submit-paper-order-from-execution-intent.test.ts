import { describe, expect, it } from "vitest";
import type {
  OrderRepository,
  ReceivedOrder,
  ReceivedOrderStatusUpdate,
  StoredExecutionIntent,
  StoredOrder
} from "../src/index.js";
import { submitPaperOrderFromExecutionIntent } from "../src/index.js";

class InMemoryOrderRepository implements OrderRepository {
  readonly orders: StoredOrder[] = [];

  async getLatestOrderByExecutionIntentId(): Promise<StoredOrder | null> {
    return null;
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

function executionIntent(): StoredExecutionIntent {
  return {
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
  };
}

describe("submitPaperOrderFromExecutionIntent", () => {
  it("records an acknowledged paper order from an execution intent", async () => {
    const repository = new InMemoryOrderRepository();
    const order = await submitPaperOrderFromExecutionIntent(
      executionIntent(),
      repository,
      "2026-05-18T00:03:00.000Z"
    );

    expect(order.status).toBe("acked");
    expect(order.venue).toBe("paper");
    expect(order.clientOrderId).toBe("BTCUSDT-buy-v1");
    expect(order.exchangeOrderId?.startsWith("paper-")).toBe(true);
    expect(repository.orders).toHaveLength(1);
  });
});
