import type {
  AgentJobMarket,
  EnqueueAgentJobInput,
  JsonValue
} from "@big-banana/domain";

export type PostPlanReviewTrigger = "manual" | "terminal_order" | "reconcile";

export type PostPlanReviewJobPayload = {
  marketKey: string;
  sourceEventKey: string;
  trigger: PostPlanReviewTrigger;
};

export function buildPostPlanReviewJobInput(
  payload: PostPlanReviewJobPayload,
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
    jobType: "post_plan_review",
    market: options.market,
    symbol: options.symbol ?? null,
    timeframe: options.timeframe ?? null,
    priority: options.priority ?? 4,
    maxAttempts: options.maxAttempts ?? 3,
    createdAt: options.createdAt,
    idempotencyKey: buildPostPlanReviewIdempotencyKey(payload),
    payloadJson: payload satisfies JsonValue
  };
}

export function parsePostPlanReviewJobPayload(
  value: JsonValue
): PostPlanReviewJobPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Post-plan review payload must be an object");
  }

  const record = value as Record<string, JsonValue>;

  if (typeof record.marketKey !== "string" || record.marketKey.trim() === "") {
    throw new Error("Post-plan review payload must include marketKey");
  }

  if (
    typeof record.sourceEventKey !== "string" ||
    record.sourceEventKey.trim() === ""
  ) {
    throw new Error("Post-plan review payload must include sourceEventKey");
  }

  if (
    record.trigger !== "manual" &&
    record.trigger !== "terminal_order" &&
    record.trigger !== "reconcile"
  ) {
    throw new Error("Post-plan review payload must include a valid trigger");
  }

  return {
    marketKey: record.marketKey,
    sourceEventKey: record.sourceEventKey,
    trigger: record.trigger
  };
}

export function buildPostPlanReviewIdempotencyKey(
  payload: PostPlanReviewJobPayload
): string {
  return `post_plan_review:${payload.marketKey}:${payload.sourceEventKey}:${payload.trigger}`;
}
