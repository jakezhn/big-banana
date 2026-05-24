import type {
  AgentJobMarket,
  CanonicalEnvelope,
  EnqueueAgentJobInput,
  JsonValue,
  RiskPolicySnapshot
} from "@big-banana/domain";

export type GeneratePlanPipelineMode = "full" | "advisory";

export type GeneratePlanJobPayload = {
  webhookEventId: string;
  envelope: CanonicalEnvelope;
  riskPolicy: RiskPolicySnapshot;
  pipelineMode: GeneratePlanPipelineMode;
};

export function buildGeneratePlanJobInput(
  payload: GeneratePlanJobPayload,
  options: {
    priority?: number;
    maxAttempts?: number;
    createdAt?: string;
  } = {}
): EnqueueAgentJobInput {
  return {
    jobType: "generate_plan",
    market: inferAgentJobMarket(payload.envelope),
    symbol: payload.envelope.context.market.tickerid,
    timeframe: payload.envelope.context.market.timeframe,
    priority: options.priority ?? 3,
    maxAttempts: options.maxAttempts ?? 3,
    createdAt: options.createdAt,
    idempotencyKey: buildGeneratePlanIdempotencyKey(payload),
    payloadJson: payload satisfies JsonValue
  };
}

export function parseGeneratePlanJobPayload(value: JsonValue): GeneratePlanJobPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Generate plan payload must be an object");
  }

  const record = value as Record<string, JsonValue>;

  if (typeof record.webhookEventId !== "string") {
    throw new Error("Generate plan payload must include webhookEventId");
  }

  if (!record.envelope || typeof record.envelope !== "object" || Array.isArray(record.envelope)) {
    throw new Error("Generate plan payload must include envelope");
  }

  if (
    !record.riskPolicy ||
    typeof record.riskPolicy !== "object" ||
    Array.isArray(record.riskPolicy)
  ) {
    throw new Error("Generate plan payload must include riskPolicy");
  }

  if (record.pipelineMode !== "full" && record.pipelineMode !== "advisory") {
    throw new Error("Generate plan payload must include a valid pipelineMode");
  }

  return {
    webhookEventId: record.webhookEventId,
    envelope: record.envelope as unknown as CanonicalEnvelope,
    riskPolicy: record.riskPolicy as unknown as RiskPolicySnapshot,
    pipelineMode: record.pipelineMode
  };
}

export function buildGeneratePlanIdempotencyKey(
  payload: GeneratePlanJobPayload
): string {
  return `generate_plan:${payload.envelope.eventKey}`;
}

export function inferAgentJobMarket(
  envelope: CanonicalEnvelope
): AgentJobMarket {
  const source = envelope.context.market.source.toUpperCase();
  const tickerid = envelope.context.market.tickerid.toUpperCase();

  if (["BINANCE", "BYBIT", "OKX", "COINBASE", "BITGET"].includes(source)) {
    return "crypto";
  }

  if (
    ["NASDAQ", "NYSE", "AMEX", "ARCA", "BATS"].includes(source) ||
    tickerid.startsWith("NASDAQ:") ||
    tickerid.startsWith("NYSE:")
  ) {
    return "us_equity";
  }

  if (
    ["SSE", "SZSE", "HKEX", "SHSE", "BJSE"].includes(source) ||
    tickerid.startsWith("SSE:") ||
    tickerid.startsWith("SZSE:") ||
    tickerid.startsWith("HKEX:")
  ) {
    return "cn_equity";
  }

  if (
    ["OANDA", "COMEX", "NYMEX", "CBOT", "ICE"].includes(source) ||
    tickerid.includes("XAU") ||
    tickerid.includes("GOLD") ||
    tickerid.includes("OIL")
  ) {
    return "commodity";
  }

  return "unknown";
}
