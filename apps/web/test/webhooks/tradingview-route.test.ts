import { describe, expect, it } from "vitest";
import { contractFixture } from "../../../../packages/domain/test/helpers.js";
import {
  type ReceivedWebhookEvent,
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
      duplicate: false
    };

    this.events.set(event.deliveryKey, stored);
    return stored;
  }
}

describe("POST /api/webhooks/tradingview", () => {
  it("accepts a valid signal payload", async () => {
    const response = await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("signal.valid.json"))),
      new InMemoryWebhookEventRepository()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      event_key: "BINANCE:BTCUSDT:240:1778404800000:signal",
      duplicate: false
    });
  });

  it("marks a repeated delivery as duplicate", async () => {
    const repository = new InMemoryWebhookEventRepository();
    const body = JSON.stringify(contractFixture("snapshot.valid.json"));

    await handleTradingViewWebhookRequest(request(body), repository);
    const response = await handleTradingViewWebhookRequest(request(body), repository);

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
      new InMemoryWebhookEventRepository()
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
      new InMemoryWebhookEventRepository()
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
      new InMemoryWebhookEventRepository()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      accepted: false,
      error: "invalid_payload"
    });
  });
});
