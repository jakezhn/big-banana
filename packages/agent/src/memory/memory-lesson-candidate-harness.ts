import type {
  AgentJobMarket,
  EnqueueAgentJobInput,
  JsonValue
} from "@big-banana/domain";

export type MemoryCurateTrigger = "manual" | "post_plan_review";

export type MemoryCurateJobPayload = {
  postPlanReviewId: string;
  trigger: MemoryCurateTrigger;
};

export function buildMemoryCurateJobInput(
  payload: MemoryCurateJobPayload,
  options: {
    market: AgentJobMarket;
    symbol?: string | null;
    timeframe?: string | null;
    priority?: number;
    maxAttempts?: number;
    createdAt?: string;
  }
): EnqueueAgentJobInput {
  return {
    jobType: "memory_curate",
    market: options.market,
    symbol: options.symbol ?? null,
    timeframe: options.timeframe ?? null,
    priority: options.priority ?? 5,
    maxAttempts: options.maxAttempts ?? 3,
    createdAt: options.createdAt,
    idempotencyKey: buildMemoryCurateIdempotencyKey(payload),
    payloadJson: payload satisfies JsonValue
  };
}

export function parseMemoryCurateJobPayload(
  value: JsonValue
): MemoryCurateJobPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Memory curate payload must be an object");
  }

  const record = value as Record<string, JsonValue>;

  if (
    typeof record.postPlanReviewId !== "string" ||
    record.postPlanReviewId.trim() === ""
  ) {
    throw new Error("Memory curate payload must include postPlanReviewId");
  }

  if (record.trigger !== "manual" && record.trigger !== "post_plan_review") {
    throw new Error("Memory curate payload must include a valid trigger");
  }

  return {
    postPlanReviewId: record.postPlanReviewId,
    trigger: record.trigger
  };
}

export function buildMemoryCurateIdempotencyKey(
  payload: MemoryCurateJobPayload
): string {
  return `memory_curate:${payload.postPlanReviewId}:${payload.trigger}`;
}
