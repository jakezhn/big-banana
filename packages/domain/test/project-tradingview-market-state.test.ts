import { describe, expect, it } from "vitest";
import { projectTradingViewMarketState } from "../src/market-state/project-tradingview-market-state.js";
import type {
  MarketStateRepository,
  ReceivedMarketState,
  StoredMarketState
} from "../src/market-state/market-state-repository.js";
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

    if (existing && existing.barTimeMs > state.barTimeMs) {
      return existing;
    }

    const stored = {
      ...state,
      id: existing?.id ?? crypto.randomUUID()
    };

    this.states.set(state.marketKey, stored);
    return stored;
  }

  async getLatestStatesByTickerid(tickerid: string): Promise<StoredMarketState[]> {
    return [...this.states.values()].filter((state) => state.tickerid === tickerid);
  }
}

describe("projectTradingViewMarketState", () => {
  it("stores the normalized market state from a snapshot", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();
    const ingestion = await ingestTradingViewPayload(
      contractFixture("snapshot.valid.json"),
      webhookRepository,
      "2026-05-17T10:00:00.000Z"
    );

    const result = await projectTradingViewMarketState(
      ingestion,
      marketStateRepository
    );

    expect(result.marketState).toMatchObject({
      marketKey: "BINANCE:BTCUSDT:240",
      tickerid: "BINANCE:BTCUSDT",
      timeframe: "240",
      barTimeMs: 1778419200000
    });
    expect(result.marketState.context.market.timeframe_label).toBe("4h");
  });

  it("does not let an older bar replace a newer current state", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();

    const newer = await ingestTradingViewPayload(
      contractFixture("snapshot.valid.json"),
      webhookRepository,
      "2026-05-17T10:00:00.000Z"
    );
    await projectTradingViewMarketState(newer, marketStateRepository);

    const older = await ingestTradingViewPayload(
      contractFixture("signal.valid.json"),
      webhookRepository,
      "2026-05-17T09:59:00.000Z"
    );
    const result = await projectTradingViewMarketState(
      older,
      marketStateRepository
    );

    expect(result.marketState.barTimeMs).toBe(1778419200000);
  });
});
