import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload.js";

export type ReceivedWebhookEvent = {
  source: CanonicalEnvelope["source"];
  schemaVersion: CanonicalEnvelope["sourceSchemaVersion"];
  deliveryKey: string;
  payloadHash: string;
  eventKey: string;
  tickerid: string;
  timeframe: string;
  barTimeMs: number;
  eventType: CanonicalEnvelope["type"];
  rawPayload: CanonicalEnvelope["raw"];
  receivedAt: string;
};

export type StoredWebhookEvent = ReceivedWebhookEvent & {
  id: string;
  lastReceivedAt: string;
  deliveryCount: number;
  duplicate: boolean;
  processStatus: string;
};

export interface WebhookEventRepository {
  recordReceivedEvent(
    event: ReceivedWebhookEvent
  ): Promise<StoredWebhookEvent>;

  updateProcessStatus(
    webhookEventId: string,
    processStatus: string
  ): Promise<void>;
}
