import type { SignalWebhookPayloadV12 } from "@big-banana/contracts";
import type {
  AgentJobMarket,
  EnqueueAgentJobInput,
  JsonValue
} from "@big-banana/domain";

export type ReplayPlannerFixture = {
  fixtureId: string;
  market: AgentJobMarket;
  symbol: string;
  timeframe: string;
  rawPayload: SignalWebhookPayloadV12;
  receivedAt?: string;
  notes?: string;
  tags?: string[];
};

export type ReplayPlannerPayload = {
  fixtureId?: string;
  rawPayload: JsonValue;
  receivedAt?: string;
  notes?: string;
  tags?: string[];
};

export type ReplayPlannerResultRef = {
  fixtureId: string | null;
  jobType: "replay_planner";
  market: AgentJobMarket;
  symbol: string | null;
  timeframe: string | null;
  marketKey: string;
  sourceEventKey: string;
  agentRunId: string;
  runnerKind: string;
  modelProvider: string | null;
  model: string | null;
  promptVersion: string | null;
  action: string;
  executionState: string;
  riskTier: string;
  executionEligible: boolean | null;
  tokenUsageJson: JsonValue | null;
};

export type ReplayPlannerSummary = {
  totalRuns: number;
  executionEligibleCount: number;
  executionIneligibleCount: number;
  unknownExecutionEligibilityCount: number;
  actionCounts: Record<string, number>;
  executionStateCounts: Record<string, number>;
  riskTierCounts: Record<string, number>;
  marketCounts: Record<string, number>;
  timeframeCounts: Record<string, number>;
  runnerKindCounts: Record<string, number>;
  promptVersionCounts: Record<string, number>;
  modelCounts: Record<string, number>;
};

export function buildReplayPlannerJobInputFromFixture(
  fixture: ReplayPlannerFixture,
  options: {
    priority?: number;
    maxAttempts?: number;
    createdAt?: string;
    idempotencyPrefix?: string;
  } = {}
): EnqueueAgentJobInput {
  return {
    jobType: "replay_planner",
    market: fixture.market,
    symbol: fixture.symbol,
    timeframe: fixture.timeframe,
    priority: options.priority ?? 5,
    maxAttempts: options.maxAttempts ?? 2,
    createdAt: options.createdAt,
    idempotencyKey: buildReplayPlannerIdempotencyKey(
      fixture,
      options.idempotencyPrefix
    ),
    payloadJson: buildReplayPlannerPayloadFromFixture(fixture)
  };
}

export function buildReplayPlannerPayloadFromFixture(
  fixture: ReplayPlannerFixture
): ReplayPlannerPayload {
  return {
    fixtureId: fixture.fixtureId,
    rawPayload: fixture.rawPayload,
    receivedAt: fixture.receivedAt,
    notes: fixture.notes,
    tags: fixture.tags
  };
}

export function buildReplayPlannerIdempotencyKey(
  fixture: ReplayPlannerFixture,
  prefix = "replay"
): string {
  return [
    prefix,
    fixture.market,
    fixture.symbol,
    fixture.timeframe,
    fixture.fixtureId
  ].join(":");
}

export function parseReplayPlannerResultRef(
  value: JsonValue
): ReplayPlannerResultRef {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Replay planner result ref must be an object");
  }

  const record = value as Record<string, JsonValue>;

  if (record.jobType !== "replay_planner") {
    throw new Error("Replay planner result ref must have jobType=replay_planner");
  }

  const market = asString(record.market, "market") as AgentJobMarket;

  return {
    fixtureId:
      record.fixtureId === null || record.fixtureId === undefined
        ? null
        : asString(record.fixtureId, "fixtureId"),
    jobType: "replay_planner",
    market,
    symbol: asOptionalString(record.symbol, "symbol"),
    timeframe: asOptionalString(record.timeframe, "timeframe"),
    marketKey: asString(record.marketKey, "marketKey"),
    sourceEventKey: asString(record.sourceEventKey, "sourceEventKey"),
    agentRunId: asString(record.agentRunId, "agentRunId"),
    runnerKind: asString(record.runnerKind, "runnerKind"),
    modelProvider: asOptionalString(record.modelProvider, "modelProvider"),
    model: asOptionalString(record.model, "model"),
    promptVersion: asOptionalString(record.promptVersion, "promptVersion"),
    action: asString(record.action, "action"),
    executionState: asString(record.executionState, "executionState"),
    riskTier: asString(record.riskTier, "riskTier"),
    executionEligible: asOptionalBoolean(
      record.executionEligible,
      "executionEligible"
    ),
    tokenUsageJson:
      record.tokenUsageJson === undefined ? null : record.tokenUsageJson
  };
}

export function summarizeReplayPlannerResultRefs(
  values: JsonValue[]
): ReplayPlannerSummary {
  const summary: ReplayPlannerSummary = {
    totalRuns: 0,
    executionEligibleCount: 0,
    executionIneligibleCount: 0,
    unknownExecutionEligibilityCount: 0,
    actionCounts: {},
    executionStateCounts: {},
    riskTierCounts: {},
    marketCounts: {},
    timeframeCounts: {},
    runnerKindCounts: {},
    promptVersionCounts: {},
    modelCounts: {}
  };

  for (const value of values) {
    const result = parseReplayPlannerResultRef(value);

    summary.totalRuns += 1;
    increment(summary.actionCounts, result.action);
    increment(summary.executionStateCounts, result.executionState);
    increment(summary.riskTierCounts, result.riskTier);
    increment(summary.marketCounts, result.market);
    increment(summary.timeframeCounts, result.timeframe ?? "unknown");
    increment(summary.runnerKindCounts, result.runnerKind);
    increment(summary.promptVersionCounts, result.promptVersion ?? "unknown");
    increment(summary.modelCounts, result.model ?? "unknown");

    if (result.executionEligible === true) {
      summary.executionEligibleCount += 1;
    } else if (result.executionEligible === false) {
      summary.executionIneligibleCount += 1;
    } else {
      summary.unknownExecutionEligibilityCount += 1;
    }
  }

  return summary;
}

function increment(counter: Record<string, number>, key: string): void {
  counter[key] = (counter[key] ?? 0) + 1;
}

function asString(value: JsonValue | undefined, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`Replay planner result ref field ${field} must be a string`);
  }

  return value;
}

function asOptionalString(
  value: JsonValue | undefined,
  field: string
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return asString(value, field);
}

function asOptionalBoolean(
  value: JsonValue | undefined,
  field: string
): boolean | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "boolean") {
    throw new Error(`Replay planner result ref field ${field} must be a boolean`);
  }

  return value;
}
