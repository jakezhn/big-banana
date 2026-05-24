import { describe, expect, it } from "vitest";
import type {
  FillRepository,
  OrderRepository,
  PositionRepository,
  ReceivedFill,
  ReceivedOrder,
  ReceivedOrderStatusUpdate,
  ReceivedPositionHistoryEntry,
  ReceivedPositionSnapshot,
  StoredFill,
  StoredOrder
} from "../src/index.js";
import { reconcilePaperOrderAndRecordFill } from "../src/index.js";

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

class InMemoryFillRepository implements FillRepository {
  readonly fills: StoredFill[] = [];

  async recordFill(fill: ReceivedFill): Promise<StoredFill> {
    const stored = { ...fill, id: crypto.randomUUID() };
    this.fills.push(stored);
    return stored;
  }

  async getLatestFillByOrderId(orderId: string): Promise<StoredFill | null> {
    return this.fills.filter((fill) => fill.orderId === orderId).at(-1) ?? null;
  }
}

class InMemoryPositionRepository implements PositionRepository {
  readonly current = new Map<string, Awaited<ReturnType<PositionRepository["upsertCurrentPosition"]>>>();
  readonly history: Awaited<ReturnType<PositionRepository["recordPositionHistory"]>>[] = [];

  async getCurrentPosition(
    tradingAccountId: string,
    symbol: string
  ): Promise<Awaited<ReturnType<PositionRepository["upsertCurrentPosition"]>> | null> {
    return this.current.get(`${tradingAccountId}:${symbol}`) ?? null;
  }

  async upsertCurrentPosition(
    position: ReceivedPositionSnapshot
  ): Promise<Awaited<ReturnType<PositionRepository["upsertCurrentPosition"]>>> {
    const key = `${position.tradingAccountId}:${position.symbol}`;
    const existing = this.current.get(key);
    const stored = { ...position, id: existing?.id ?? crypto.randomUUID() };
    this.current.set(key, stored);
    return stored;
  }

  async recordPositionHistory(
    entry: ReceivedPositionHistoryEntry
  ): Promise<Awaited<ReturnType<PositionRepository["recordPositionHistory"]>>> {
    const stored = { ...entry, id: crypto.randomUUID() };
    this.history.push(stored);
    return stored;
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

describe("reconcilePaperOrderAndRecordFill", () => {
  it("records both the fill and the resulting position on filled outcome", async () => {
    const orderRepository = new InMemoryOrderRepository(ackedOrder());
    const fillRepository = new InMemoryFillRepository();
    const positionRepository = new InMemoryPositionRepository();

    const result = await reconcilePaperOrderAndRecordFill(
      "BINANCE:BTCUSDT:240",
      ackedOrder(),
      "filled",
      orderRepository,
      fillRepository,
      positionRepository,
      "2026-05-19T00:10:00.000Z"
    );

    expect(result.order.status).toBe("filled");
    expect(result.fill?.qty).toBe(0.18);
    expect(result.positionUpdate?.currentPosition.positionSide).toBe("long");
    expect(result.positionUpdate?.historyEntry.eventType).toBe("open");
  });

  it("does not record a fill for canceled outcome", async () => {
    const orderRepository = new InMemoryOrderRepository(ackedOrder());
    const fillRepository = new InMemoryFillRepository();
    const positionRepository = new InMemoryPositionRepository();

    const result = await reconcilePaperOrderAndRecordFill(
      "BINANCE:BTCUSDT:240",
      ackedOrder(),
      "canceled",
      orderRepository,
      fillRepository,
      positionRepository,
      "2026-05-19T00:10:00.000Z"
    );

    expect(result.order.status).toBe("canceled");
    expect(result.fill).toBeNull();
    expect(result.positionUpdate).toBeNull();
  });
});
