import type { SignalWebhookPayloadV12, TradePlan } from "@big-banana/contracts";
import type {
  AgentRunRepository,
  MarketStateRepository,
  OrderRepository,
  PlanRevisionSuggestionRepository,
  PositionRepository,
  ReceivedAgentRun,
  ReceivedMarketState,
  ReceivedOrder,
  ReceivedPlanRevisionSuggestion,
  ReceivedPlanTransition,
  ReceivedPositionSnapshot,
  ReceivedPositionHistoryEntry,
  ReceivedTradePlanVersion,
  StoredAgentRun,
  StoredMarketState,
  StoredOrder,
  StoredPlanRevisionSuggestion,
  StoredPlanTransition,
  StoredPositionHistoryEntry,
  StoredPositionSnapshot,
  StoredTradePlanVersion,
  TradePlanVersionRepository
} from "@big-banana/domain";
import { describe, expect, it } from "vitest";
import { defaultReplayPlannerFixtures } from "../src/replay/default-replay-planner-fixtures";
import { createRevisePlanHandler } from "../src/worker/revision/revise-plan-handler";

describe("createRevisePlanHandler", () => {
  it("records a deterministic revision suggestion for an active watch plan", async () => {
    const fixture = defaultReplayPlannerFixtures[0]!;
    const marketStateRepository = new InMemoryMarketStateRepository([
      buildStoredMarketState(fixture.rawPayload)
    ]);
    const activePlan = buildActivePlan(fixture.rawPayload);
    const tradePlanVersionRepository = new InMemoryTradePlanVersionRepository(activePlan);
    const orderRepository = new InMemoryOrderRepository();
    const positionRepository = new InMemoryPositionRepository();
    const planRevisionSuggestionRepository =
      new InMemoryPlanRevisionSuggestionRepository();
    const agentRunRepository = new InMemoryAgentRunRepository();

    const handler = createRevisePlanHandler(
      {
        marketStateRepository,
        tradePlanVersionRepository,
        orderRepository,
        positionRepository,
        planRevisionSuggestionRepository,
        agentRunRepository,
        tradingAccountId: "paper-tradingview"
      },
      { PLANNER_RUNTIME: "deterministic" } satisfies NodeJS.ProcessEnv
    );

    const result = await handler(
      {
        id: "job-1",
        jobType: "revise_plan",
        status: "running",
        market: fixture.market,
        symbol: fixture.symbol,
        timeframe: fixture.timeframe,
        signalId: "sig-1",
        planId: activePlan.planId,
        priority: 1,
        idempotencyKey: "revise_plan:test",
        payloadJson: {
          envelope: {
            source: "tradingview",
            sourceSchemaVersion: "bitpunk.webhook.v12",
            raw: fixture.rawPayload,
            type: "signal",
            eventKey: `${fixture.rawPayload.context.market.tickerid}:${fixture.rawPayload.context.market.timeframe}:${fixture.rawPayload.context.bar.time_ms}:signal`,
            marketKey: `${fixture.rawPayload.context.market.tickerid}:${fixture.rawPayload.context.market.timeframe}`,
            context: fixture.rawPayload.context,
            signal: fixture.rawPayload.signal
          },
          trigger: "signal"
        },
        resultRefJson: null,
        lockedBy: "hermes-test",
        lockedAt: "2026-05-25T10:00:00.000Z",
        lockedUntil: "2026-05-25T10:01:00.000Z",
        attemptCount: 0,
        maxAttempts: 2,
        runAfter: "2026-05-25T09:59:00.000Z",
        lastError: null,
        createdAt: "2026-05-25T09:59:00.000Z",
        updatedAt: "2026-05-25T10:00:00.000Z"
      },
      {
        now: () => "2026-05-25T10:00:01.000Z",
        logger: console
      }
    );

    expect(result).toMatchObject({
      jobType: "revise_plan",
      revisionAction: "upgrade",
      requiresUserReview: false,
      planId: activePlan.planId,
      tradePlanVersionId: activePlan.id
    });
    expect(agentRunRepository.runs).toHaveLength(1);
    expect(agentRunRepository.runs[0]?.operation).toBe("plan.revise");
    expect(agentRunRepository.runs[0]?.skillName).toBe("revise_trade_plan.crypto");
    expect(agentRunRepository.runs[0]?.promptVersion).toBe(
      "deterministic-plan-revision-v1:crypto"
    );
    expect(planRevisionSuggestionRepository.suggestions).toHaveLength(1);
    expect(planRevisionSuggestionRepository.suggestions[0]?.revisionAction).toBe(
      "upgrade"
    );
  });
});

class InMemoryMarketStateRepository implements MarketStateRepository {
  constructor(private readonly states: StoredMarketState[]) {}

  async recordMarketState(state: ReceivedMarketState): Promise<StoredMarketState> {
    return {
      id: `ms-${this.states.length + 1}`,
      ...state
    };
  }

  async getLatestStatesByTickerid(tickerid: string): Promise<StoredMarketState[]> {
    return this.states.filter((state) => state.tickerid === tickerid);
  }

  async getRecentMarketStatesByMarketKey(
    marketKey: string,
    limit: number
  ): Promise<StoredMarketState[]> {
    return this.states
      .filter((state) => state.marketKey === marketKey)
      .sort((a, b) => a.barTimeMs - b.barTimeMs)
      .slice(-limit);
  }
}

class InMemoryTradePlanVersionRepository implements TradePlanVersionRepository {
  constructor(private readonly activePlan: StoredTradePlanVersion) {}

  async getLatestTradePlanVersion(): Promise<StoredTradePlanVersion | null> {
    return this.activePlan;
  }

  async getLatestTradePlanVersionByMarketKey(
    marketKey: string
  ): Promise<StoredTradePlanVersion | null> {
    return this.activePlan.marketKey === marketKey ? this.activePlan : null;
  }

  async recordTradePlanVersion(
    version: ReceivedTradePlanVersion
  ): Promise<StoredTradePlanVersion> {
    return { id: crypto.randomUUID(), ...version };
  }

  async recordPlanTransition(
    transition: ReceivedPlanTransition
  ): Promise<StoredPlanTransition> {
    return { id: crypto.randomUUID(), ...transition };
  }
}

class InMemoryOrderRepository implements OrderRepository {
  async getLatestOrderByExecutionIntentId(): Promise<StoredOrder | null> {
    return null;
  }

  async getOpenOrdersByTradingAccountIdAndSymbol(): Promise<StoredOrder[]> {
    return [];
  }

  async recordOrder(order: ReceivedOrder): Promise<StoredOrder> {
    return { id: crypto.randomUUID(), ...order };
  }

  async updateOrderStatus(): Promise<StoredOrder> {
    throw new Error("Not used in revise handler test");
  }
}

class InMemoryPositionRepository implements PositionRepository {
  async getCurrentPosition(): Promise<StoredPositionSnapshot | null> {
    return null;
  }

  async upsertCurrentPosition(
    position: ReceivedPositionSnapshot
  ): Promise<StoredPositionSnapshot> {
    return { id: crypto.randomUUID(), ...position };
  }

  async recordPositionHistory(
    entry: ReceivedPositionHistoryEntry
  ): Promise<StoredPositionHistoryEntry> {
    return { id: crypto.randomUUID(), ...entry };
  }
}

class InMemoryPlanRevisionSuggestionRepository
  implements PlanRevisionSuggestionRepository
{
  suggestions: StoredPlanRevisionSuggestion[] = [];

  async recordPlanRevisionSuggestion(
    suggestion: ReceivedPlanRevisionSuggestion
  ): Promise<StoredPlanRevisionSuggestion> {
    const stored = { id: crypto.randomUUID(), ...suggestion };
    this.suggestions.push(stored);
    return stored;
  }

  async getLatestPlanRevisionSuggestionByPlanId(
    planId: string
  ): Promise<StoredPlanRevisionSuggestion | null> {
    return this.suggestions.filter((entry) => entry.planId === planId).at(-1) ?? null;
  }

  async listPlanRevisionSuggestionsByPlanId(
    planId: string
  ): Promise<StoredPlanRevisionSuggestion[]> {
    return this.suggestions.filter((entry) => entry.planId === planId);
  }
}

class InMemoryAgentRunRepository implements AgentRunRepository {
  runs: StoredAgentRun[] = [];

  async recordAgentRun(run: ReceivedAgentRun): Promise<StoredAgentRun> {
    const stored: StoredAgentRun = {
      id: `run-${this.runs.length + 1}`,
      ...run
    };

    this.runs.push(stored);
    return stored;
  }
}

function buildStoredMarketState(
  payload: SignalWebhookPayloadV12
): StoredMarketState {
  return {
    id: "ms-1",
    marketKey: `${payload.context.market.tickerid}:${payload.context.market.timeframe}`,
    webhookEventId: "wh-1",
    tickerid: payload.context.market.tickerid,
    timeframe: payload.context.market.timeframe,
    barTimeMs: payload.context.bar.time_ms,
    context: payload.context,
    createdAt: "2026-05-25T09:59:00.000Z"
  };
}

function buildActivePlan(payload: SignalWebhookPayloadV12): StoredTradePlanVersion {
  const tradePlan: TradePlan = {
    action: "create",
    market_thesis: {
      bias: payload.signal.direction,
      environment: "trend",
      htf_bias: payload.context.momentum.direction === "bull" ? "bull" : "bear",
      mtf_bias: payload.context.osc.direction === "bull" ? "bull" : "bear",
      bias_confidence: 0.7,
      trend_end_score: 0.2,
      structure_summary: "Existing watch plan for the same directional setup.",
      key_levels: [
        {
          role: payload.signal.direction === "long" ? "support" : "resistance",
          price_ref: "EMA50",
          importance: "primary"
        }
      ]
    },
    execution_playbook: {
      state: "watch",
      entry_style: "pullback",
      entry_zone: {
        low: payload.context.structure.ema50 - 1,
        high: payload.context.structure.ema50 + 1,
        source: "structure"
      },
      allowed_triggers: ["aligned_signal"],
      requires_signal: true,
      disqualifiers: ["loss_of_structure"],
      tp_style: "ladder",
      update_policy: "minor_patch"
    },
    risk_intent: {
      risk_tier: "starter",
      suggested_max_account_risk_pct: 0.75,
      stop_anchor: payload.signal.direction === "long" ? "swing_low" : "swing_high",
      stop_buffer_atr: 0.25,
      rationale_codes: ["WATCH_SETUP"]
    },
    reasoning_summary: "Existing watch plan awaiting better trigger quality.",
    evidence: ["existing_watch_plan"]
  };

  return {
    id: "tpv-1",
    planId: "plan-1",
    version: 1,
    marketKey: `${payload.context.market.tickerid}:${payload.context.market.timeframe}`,
    sourceEventKey: `${payload.context.market.tickerid}:${payload.context.market.timeframe}:previous`,
    action: tradePlan.action,
    marketThesis: tradePlan.market_thesis,
    executionPlaybook: tradePlan.execution_playbook,
    riskIntent: tradePlan.risk_intent,
    reasoningSummary: tradePlan.reasoning_summary,
    evidence: tradePlan.evidence,
    createdAt: "2026-05-25T09:30:00.000Z"
  };
}
