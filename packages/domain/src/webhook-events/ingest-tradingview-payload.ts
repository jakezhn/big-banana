import { createHash } from "node:crypto";
import {
  normalizeTradingViewPayload,
  type CanonicalEnvelope
} from "../tradingview/normalize-tradingview-payload";
import type {
  StoredWebhookEvent,
  WebhookEventRepository
} from "./webhook-event-repository";

export type TradingViewIngestionResult = {
  envelope: CanonicalEnvelope;
  webhookEvent: StoredWebhookEvent;
};

export async function ingestTradingViewPayload(
  payload: unknown,
  repository: WebhookEventRepository,
  receivedAt = new Date().toISOString()
): Promise<TradingViewIngestionResult> {
  const envelope = normalizeTradingViewPayload(payload, receivedAt);
  const payloadHash = sha256(stableStringify(envelope.raw));
  const webhookEvent = await repository.recordReceivedEvent({
    source: envelope.source,
    schemaVersion: envelope.sourceSchemaVersion,
    deliveryKey: `${envelope.source}:${payloadHash}`,
    payloadHash,
    eventKey: envelope.eventKey,
    tickerid: envelope.context.market.tickerid,
    timeframe: envelope.context.market.timeframe,
    barTimeMs: envelope.barTimeMs,
    eventType: envelope.type,
    rawPayload: envelope.raw,
    receivedAt
  });

  return {
    envelope,
    webhookEvent
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
    .join(",")}}`;
}
