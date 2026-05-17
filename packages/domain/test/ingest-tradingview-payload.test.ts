import { describe, expect, it } from "vitest";
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
      duplicate: false
    };

    this.events.set(event.deliveryKey, stored);
    return stored;
  }
}

describe("ingestTradingViewPayload", () => {
  it("records a normalized webhook event", async () => {
    const repository = new InMemoryWebhookEventRepository();
    const result = await ingestTradingViewPayload(
      contractFixture("signal.valid.json"),
      repository,
      "2026-05-17T10:00:00.000Z"
    );

    expect(result.webhookEvent).toMatchObject({
      source: "tradingview",
      schemaVersion: "bitpunk.webhook.v12",
      eventKey: "BINANCE:BTCUSDT:240:1778404800000:signal",
      tickerid: "BINANCE:BTCUSDT",
      timeframe: "240",
      barTimeMs: 1778404800000,
      eventType: "signal",
      deliveryCount: 1,
      duplicate: false
    });
    expect(result.webhookEvent.deliveryKey).toMatch(/^tradingview:[a-f0-9]{64}$/);
  });

  it("marks repeated deliveries as duplicates", async () => {
    const repository = new InMemoryWebhookEventRepository();
    const payload = contractFixture("snapshot.valid.json");

    const first = await ingestTradingViewPayload(
      payload,
      repository,
      "2026-05-17T10:00:00.000Z"
    );
    const second = await ingestTradingViewPayload(
      payload,
      repository,
      "2026-05-17T10:01:00.000Z"
    );

    expect(second.webhookEvent.deliveryKey).toBe(first.webhookEvent.deliveryKey);
    expect(second.webhookEvent).toMatchObject({
      deliveryCount: 2,
      duplicate: true,
      lastReceivedAt: "2026-05-17T10:01:00.000Z"
    });
  });

  it("uses stable hashing for semantically identical payloads", async () => {
    const repository = new InMemoryWebhookEventRepository();
    const payload = contractFixture("snapshot.valid.json") as Record<string, unknown>;
    const reorderedPayload = Object.fromEntries(Object.entries(payload).reverse());

    const first = await ingestTradingViewPayload(payload, repository);
    const second = await ingestTradingViewPayload(reorderedPayload, repository);

    expect(second.webhookEvent.deliveryKey).toBe(first.webhookEvent.deliveryKey);
    expect(second.webhookEvent.duplicate).toBe(true);
  });
});
