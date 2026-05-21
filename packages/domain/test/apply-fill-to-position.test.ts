import { describe, expect, it } from "vitest";
import type {
  FillRepository,
  PositionRepository,
  ReceivedPositionHistoryEntry,
  ReceivedPositionSnapshot,
  StoredFill
} from "../src/index.js";
import { applyFillToPosition } from "../src/index.js";

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

function fill(overrides?: Partial<StoredFill>): StoredFill {
  return {
    id: "fill-1",
    orderId: "order-1",
    executionIntentId: "intent-1",
    tradingAccountId: "acct-1",
    venue: "paper",
    symbol: "BTCUSDT",
    side: "buy",
    qty: 0.2,
    price: 67000,
    filledAt: "2026-05-21T10:00:00.000Z",
    exchangeFillId: "paper:fill-1",
    rawExchangeJson: {},
    ...overrides
  };
}

describe("applyFillToPosition", () => {
  it("opens a long position from the first buy fill", async () => {
    const repository = new InMemoryPositionRepository();

    const result = await applyFillToPosition(
      {
        marketKey: "BINANCE:BTCUSDT:240",
        fill: fill()
      },
      repository
    );

    expect(result.currentPosition.positionSide).toBe("long");
    expect(result.currentPosition.signedQty).toBe(0.2);
    expect(result.currentPosition.avgEntryPrice).toBe(67000);
    expect(result.historyEntry.eventType).toBe("open");
  });

  it("reduces an existing long position without changing the average entry", async () => {
    const repository = new InMemoryPositionRepository();
    await repository.upsertCurrentPosition({
      tradingAccountId: "acct-1",
      symbol: "BTCUSDT",
      marketKey: "BINANCE:BTCUSDT:240",
      positionSide: "long",
      signedQty: 0.3,
      avgEntryPrice: 66800,
      openedAt: "2026-05-21T09:00:00.000Z",
      closedAt: null,
      updatedAt: "2026-05-21T09:00:00.000Z",
      lastFillId: "fill-0"
    });

    const result = await applyFillToPosition(
      {
        marketKey: "BINANCE:BTCUSDT:240",
        fill: fill({
          id: "fill-2",
          side: "sell",
          qty: 0.1,
          price: 67150
        })
      },
      repository
    );

    expect(result.currentPosition.positionSide).toBe("long");
    expect(result.currentPosition.signedQty).toBe(0.2);
    expect(result.currentPosition.avgEntryPrice).toBe(66800);
    expect(result.historyEntry.eventType).toBe("reduce");
  });

  it("closes a position when an opposing fill offsets it exactly", async () => {
    const repository = new InMemoryPositionRepository();
    await repository.upsertCurrentPosition({
      tradingAccountId: "acct-1",
      symbol: "BTCUSDT",
      marketKey: "BINANCE:BTCUSDT:240",
      positionSide: "long",
      signedQty: 0.2,
      avgEntryPrice: 67000,
      openedAt: "2026-05-21T09:00:00.000Z",
      closedAt: null,
      updatedAt: "2026-05-21T09:00:00.000Z",
      lastFillId: "fill-0"
    });

    const result = await applyFillToPosition(
      {
        marketKey: "BINANCE:BTCUSDT:240",
        fill: fill({
          id: "fill-3",
          side: "sell",
          qty: 0.2,
          price: 67200
        })
      },
      repository
    );

    expect(result.currentPosition.positionSide).toBe("flat");
    expect(result.currentPosition.signedQty).toBe(0);
    expect(result.currentPosition.avgEntryPrice).toBeNull();
    expect(result.historyEntry.eventType).toBe("close");
  });
});
