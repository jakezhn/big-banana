import {
  getWebhookPayloadV12ValidationErrors,
  validateWebhookPayloadV12,
  webhookPayloadV12SchemaVersion,
  type WebhookPayloadV12
} from "@big-banana/contracts";

export type CanonicalEnvelope = {
  source: "tradingview";
  sourceSchemaVersion: typeof webhookPayloadV12SchemaVersion;
  internalSchemaVersion: "core.alert.v1";
  type: "snapshot" | "signal";
  marketKey: string;
  eventKey: string;
  barTimeMs: number;
  receivedAt: string;
  context: WebhookPayloadV12["context"];
  signal?: Extract<WebhookPayloadV12, { type: "signal" }>["signal"];
  raw: WebhookPayloadV12;
};

export class InvalidTradingViewPayloadError extends Error {
  readonly issues: ReturnType<typeof getWebhookPayloadV12ValidationErrors>;

  constructor(issues: ReturnType<typeof getWebhookPayloadV12ValidationErrors>) {
    super("Invalid TradingView webhook payload");
    this.name = "InvalidTradingViewPayloadError";
    this.issues = issues;
  }
}

export function normalizeTradingViewPayload(
  payload: unknown,
  receivedAt = new Date().toISOString()
): CanonicalEnvelope {
  if (!validateWebhookPayloadV12(payload)) {
    throw new InvalidTradingViewPayloadError(
      getWebhookPayloadV12ValidationErrors()
    );
  }

  const {
    context: {
      market: { tickerid, timeframe },
      bar: { time_ms: barTimeMs }
    },
    type
  } = payload;

  const marketKey = `${tickerid}:${timeframe}`;
  const eventKey = `${marketKey}:${barTimeMs}:${type}`;

  return {
    source: "tradingview",
    sourceSchemaVersion: payload.schema_version,
    internalSchemaVersion: "core.alert.v1",
    type,
    marketKey,
    eventKey,
    barTimeMs,
    receivedAt,
    context: payload.context,
    ...(payload.type === "signal" ? { signal: payload.signal } : {}),
    raw: payload
  };
}
