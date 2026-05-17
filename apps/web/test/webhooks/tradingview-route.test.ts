import { describe, expect, it } from "vitest";
import { contractFixture } from "../../../../packages/domain/test/helpers.js";
import {
  type MarketStateRepository,
  type ReceivedMarketState,
  type ReceivedWebhookEvent,
  type StoredMarketState,
  type StoredWebhookEvent,
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
}

describe("POST /api/webhooks/tradingview", () => {
  it("accepts a valid signal payload", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const response = await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("signal.valid.json"))),
      webhookRepository,
      new InMemoryMarketStateRepository()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      event_key: "BINANCE:BTCUSDT:240:1778404800000:signal",
      duplicate: false
    });
    expect([...webhookRepository.events.values()][0]?.processStatus).toBe(
      "normalized"
    );
  });

  it("marks a repeated delivery as duplicate", async () => {
    const repository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();
    const body = JSON.stringify(contractFixture("snapshot.valid.json"));

    await handleTradingViewWebhookRequest(
      request(body),
      repository,
      marketStateRepository
    );
    const response = await handleTradingViewWebhookRequest(
      request(body),
      repository,
      marketStateRepository
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      event_key: "BINANCE:BTCUSDT:240:1778419200000:snapshot",
      duplicate: true
    });
  });

  it("rejects non-json content types", async () => {
    const response = await handleTradingViewWebhookRequest(
      request("{}", "text/plain"),
      new InMemoryWebhookEventRepository(),
      new InMemoryMarketStateRepository()
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
      new InMemoryWebhookEventRepository(),
      new InMemoryMarketStateRepository()
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
      new InMemoryWebhookEventRepository(),
      new InMemoryMarketStateRepository()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      accepted: false,
      error: "invalid_payload"
    });
  });
});
