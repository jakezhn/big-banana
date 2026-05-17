import { readFileSync } from "node:fs";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

export const webhookPayloadV12SchemaVersion = "bitpunk.webhook.v12" as const;

type MarketContext = {
  tickerid: string;
  source: string;
  timeframe: string;
  timeframe_label: string;
};

type BarContext = {
  index: number;
  time_ms: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type SharedContext = {
  market: MarketContext;
  bar: BarContext;
  volatility: {
    atr: number;
    atr_len: number;
  };
  regime: {
    name: string;
    trend_score: number;
  };
  structure: {
    ema20: number;
    ema50: number;
    ema100: number;
    ema200: number;
    relative_high: number;
    relative_low: number;
  };
  momentum: {
    value: number;
    direction: string;
    sqz: string;
  };
  osc: {
    fast: number;
    slow: number;
    spread: number;
    direction: string;
  };
};

type SignalDetail = {
  direction: "long" | "short";
  rank_level: 1 | 2 | 3 | 4;
  rank_pct: number;
  regime: "expansion" | "pullback" | "transition" | "neutral";
  regime_alignement: "align" | "counter" | "neutral";
  kl: {
    has_kl: boolean;
    role: "support" | "resistance" | "none";
    source: string;
  };
  divergence: {
    has_divergence: boolean;
  };
  gain: number;
  pain: number;
  proposed_size: number;
};

export type SnapshotWebhookPayloadV12 = {
  schema_version: typeof webhookPayloadV12SchemaVersion;
  type: "snapshot";
  context: SharedContext;
};

export type SignalWebhookPayloadV12 = {
  schema_version: typeof webhookPayloadV12SchemaVersion;
  type: "signal";
  context: SharedContext;
  signal: SignalDetail;
};

export type WebhookPayloadV12 =
  | SnapshotWebhookPayloadV12
  | SignalWebhookPayloadV12;

const schemaUrl = new URL("../schemas/webhook-payload-v12.schema.json", import.meta.url);
const schema = JSON.parse(readFileSync(schemaUrl, "utf8")) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile<WebhookPayloadV12>(schema);

export function validateWebhookPayloadV12(
  payload: unknown
): payload is WebhookPayloadV12 {
  return validate(payload);
}

export function getWebhookPayloadV12ValidationErrors(): ErrorObject[] {
  return validate.errors ?? [];
}
