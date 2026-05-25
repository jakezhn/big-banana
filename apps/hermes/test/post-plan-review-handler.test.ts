import type {
  AgentRunRepository,
  MarketPipelineReadModel,
  MarketPipelineReadModelRepository,
  ReceivedAgentRun,
  ReceivedPostPlanReview,
  PostPlanReviewRepository,
  StoredAgentRun,
  StoredPostPlanReview
} from "@big-banana/domain";
import { describe, expect, it } from "vitest";
import { createPostPlanReviewHandler } from "../src/worker/review/post-plan-review-handler";
import { defaultReplayPlannerFixtures } from "../src/replay/default-replay-planner-fixtures";

describe("createPostPlanReviewHandler", () => {
  it("records a deterministic post-plan review for a reviewable pipeline", async () => {
    const fixture = defaultReplayPlannerFixtures[0]!;
    const marketKey = `${fixture.rawPayload.context.market.tickerid}:${fixture.rawPayload.context.market.timeframe}`;
    const pipeline = buildPipelineReadModel(marketKey);
    const marketPipelineReadModelRepository =
      new InMemoryMarketPipelineReadModelRepository(pipeline);
    const postPlanReviewRepository = new InMemoryPostPlanReviewRepository();
    const agentRunRepository = new InMemoryAgentRunRepository();

    const handler = createPostPlanReviewHandler(
      {
        marketPipelineReadModelRepository,
        postPlanReviewRepository,
        agentRunRepository
      },
      { PLANNER_RUNTIME: "deterministic" } satisfies NodeJS.ProcessEnv
    );

    const result = await handler(
      {
        id: "job-1",
        jobType: "post_plan_review",
        status: "running",
        market: fixture.market,
        symbol: fixture.symbol,
        timeframe: fixture.timeframe,
        signalId: null,
        planId: pipeline.tradePlanVersion?.planId ?? null,
        priority: 1,
        idempotencyKey: "post_plan_review:test",
        payloadJson: {
          marketKey,
          sourceEventKey: pipeline.tradePlanVersion?.sourceEventKey ?? "evt-1",
          trigger: "reconcile"
        },
        resultRefJson: null,
        lockedBy: "hermes-test",
        lockedAt: "2026-05-25T16:00:00.000Z",
        lockedUntil: "2026-05-25T16:01:00.000Z",
        attemptCount: 0,
        maxAttempts: 2,
        runAfter: "2026-05-25T15:59:00.000Z",
        lastError: null,
        createdAt: "2026-05-25T15:59:00.000Z",
        updatedAt: "2026-05-25T16:00:00.000Z"
      },
      {
        now: () => "2026-05-25T16:00:01.000Z",
        logger: console
      }
    );

    expect(result).toMatchObject({
      jobType: "post_plan_review",
      marketKey,
      lessonCandidateCount: 1,
      shouldUpdateStrategyMemory: true,
      planId: pipeline.tradePlanVersion?.planId
    });
    expect(agentRunRepository.runs).toHaveLength(1);
    expect(agentRunRepository.runs[0]?.operation).toBe("plan.review");
    expect(agentRunRepository.runs[0]?.skillName).toBe("review_trade_plan.crypto");
    expect(agentRunRepository.runs[0]?.promptVersion).toBe(
      "deterministic-post-plan-review-v1:crypto"
    );
    expect(postPlanReviewRepository.reviews).toHaveLength(1);
    expect(postPlanReviewRepository.reviews[0]?.lessonCandidates).toHaveLength(1);
  });
});

class InMemoryMarketPipelineReadModelRepository
  implements MarketPipelineReadModelRepository
{
  constructor(private readonly pipeline: MarketPipelineReadModel) {}

  async getLatestMarketPipeline(
    marketKey: string
  ): Promise<MarketPipelineReadModel | null> {
    return this.pipeline.marketKey === marketKey ? this.pipeline : null;
  }
}

class InMemoryPostPlanReviewRepository implements PostPlanReviewRepository {
  reviews: StoredPostPlanReview[] = [];

  async getPostPlanReviewById(
    reviewId: string
  ): Promise<StoredPostPlanReview | null> {
    return this.reviews.find((entry) => entry.id === reviewId) ?? null;
  }

  async recordPostPlanReview(
    review: ReceivedPostPlanReview
  ): Promise<StoredPostPlanReview> {
    const stored = { id: crypto.randomUUID(), ...review };
    this.reviews.push(stored);
    return stored;
  }

  async getLatestPostPlanReviewByPlanId(
    planId: string
  ): Promise<StoredPostPlanReview | null> {
    return this.reviews.filter((entry) => entry.planId === planId).at(-1) ?? null;
  }

  async listPostPlanReviewsByPlanId(
    planId: string
  ): Promise<StoredPostPlanReview[]> {
    return this.reviews.filter((entry) => entry.planId === planId);
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

function buildPipelineReadModel(marketKey: string): MarketPipelineReadModel {
  return {
    marketKey,
    marketState: null,
    tradePlanVersion: {
      id: "tpv-1",
      planId: "plan-1",
      version: 2,
      marketKey,
      sourceEventKey: "evt-1",
      action: "create",
      marketThesis: {
        bias: "long",
        environment: "trend",
        htf_bias: "bull",
        mtf_bias: "bull",
        bias_confidence: 0.82,
        trend_end_score: 0.18,
        structure_summary: "Trend continuation remained intact.",
        key_levels: [
          {
            role: "support",
            price_ref: "EMA50",
            importance: "primary"
          }
        ]
      },
      executionPlaybook: {
        state: "closed",
        entry_style: "pullback",
        entry_zone: {
          low: 100,
          high: 102,
          source: "structure"
        },
        allowed_triggers: ["aligned_signal"],
        requires_signal: true,
        disqualifiers: ["loss_of_structure"],
        tp_style: "ladder",
        update_policy: "minor_patch"
      },
      riskIntent: {
        risk_tier: "starter",
        suggested_max_account_risk_pct: 0.75,
        stop_anchor: "swing_low",
        stop_buffer_atr: 0.25,
        rationale_codes: ["ALIGNED_SIGNAL"]
      },
      reasoningSummary: "Pullback continuation plan.",
      evidence: ["aligned_signal", "trend_continuation"],
      createdAt: "2026-05-25T15:00:00.000Z"
    },
    latestPlanRevisionSuggestion: null,
    latestPostPlanReview: null,
    memoryLessonCandidates: [],
    riskVerdict: null,
    executionIntent: null,
    latestOrder: {
      id: "order-1",
      executionIntentId: "intent-1",
      tradingAccountId: "paper-tradingview",
      venue: "paper",
      symbol: "BINANCE:BTCUSDT",
      side: "buy",
      orderType: "limit",
      timeInForce: "GTC",
      reduceOnly: false,
      clientOrderId: "coid-1",
      exchangeOrderId: "eo-1",
      status: "filled",
      requestedQty: 1,
      requestedPrice: 101,
      stopPrice: 98,
      avgFillPrice: 101,
      filledQty: 1,
      submittedAt: "2026-05-25T15:10:00.000Z",
      lastExchangeUpdateAt: "2026-05-25T15:11:00.000Z",
      terminalAt: "2026-05-25T15:11:00.000Z",
      rawExchangeJson: {}
    },
    latestFill: {
      id: "fill-1",
      orderId: "order-1",
      executionIntentId: "intent-1",
      tradingAccountId: "paper-tradingview",
      venue: "paper",
      symbol: "BINANCE:BTCUSDT",
      side: "buy",
      qty: 1,
      price: 101,
      filledAt: "2026-05-25T15:11:00.000Z",
      exchangeFillId: "ef-1",
      rawExchangeJson: {}
    },
    currentPosition: {
      id: "pos-1",
      tradingAccountId: "paper-tradingview",
      symbol: "BINANCE:BTCUSDT",
      marketKey,
      positionSide: "flat",
      signedQty: 0,
      avgEntryPrice: null,
      openedAt: "2026-05-25T15:11:00.000Z",
      closedAt: "2026-05-25T15:20:00.000Z",
      updatedAt: "2026-05-25T15:20:00.000Z",
      lastFillId: "fill-1"
    }
  };
}
