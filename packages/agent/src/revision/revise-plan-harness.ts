import type {
  AgentJobMarket,
  CanonicalEnvelope,
  EnqueueAgentJobInput,
  JsonValue
} from "@big-banana/domain";
import { inferAgentJobMarket } from "../planner/generate-plan-harness";

export type RevisePlanTrigger = "signal" | "snapshot" | "manual";

export type RevisePlanJobPayload = {
  envelope: CanonicalEnvelope;
  trigger: RevisePlanTrigger;
};

export function buildRevisePlanJobInput(
  payload: RevisePlanJobPayload,
  options: {
    priority?: number;
    maxAttempts?: number;
    createdAt?: string;
  } = {}
): EnqueueAgentJobInput {
  return {
    jobType: "revise_plan",
    market: inferAgentJobMarket(payload.envelope),
    symbol: payload.envelope.context.market.tickerid,
    timeframe: payload.envelope.context.market.timeframe,
    priority: options.priority ?? 2,
    maxAttempts: options.maxAttempts ?? 3,
    createdAt: options.createdAt,
    idempotencyKey: buildRevisePlanIdempotencyKey(payload),
    payloadJson: payload satisfies JsonValue
  };
}

export function parseRevisePlanJobPayload(value: JsonValue): RevisePlanJobPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Revise plan payload must be an object");
  }

  const record = value as Record<string, JsonValue>;

  if (!record.envelope || typeof record.envelope !== "object" || Array.isArray(record.envelope)) {
    throw new Error("Revise plan payload must include envelope");
  }

  if (
    record.trigger !== "signal" &&
    record.trigger !== "snapshot" &&
    record.trigger !== "manual"
  ) {
    throw new Error("Revise plan payload must include a valid trigger");
  }

  return {
    envelope: record.envelope as unknown as CanonicalEnvelope,
    trigger: record.trigger
  };
}

export function buildRevisePlanIdempotencyKey(
  payload: RevisePlanJobPayload
): string {
  return `revise_plan:${payload.envelope.eventKey}:${payload.trigger}`;
}

export function inferRevisionJobMarket(
  envelope: CanonicalEnvelope
): AgentJobMarket {
  return inferAgentJobMarket(envelope);
}
