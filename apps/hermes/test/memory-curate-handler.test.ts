import type {
  AgentRunRepository,
  MarketPipelineReadModel,
  MarketPipelineReadModelRepository,
  MemoryLessonCandidateRepository,
  ReceivedAgentRun,
  ReceivedMemoryLessonCandidate,
  ReceivedPostPlanReview,
  StoredAgentRun,
  StoredMemoryLessonCandidate,
  StoredPostPlanReview,
  PostPlanReviewRepository
} from "@big-banana/domain";
import { describe, expect, it } from "vitest";
import { createMemoryCurateHandler } from "../src/worker/memory/memory-curate-handler";
import { defaultReplayPlannerFixtures } from "../src/replay/default-replay-planner-fixtures";

describe("createMemoryCurateHandler", () => {
  it("records deterministic memory lesson candidates for a persisted review", async () => {
    const fixture = defaultReplayPlannerFixtures[0]!;
    const marketKey = `${fixture.rawPayload.context.market.tickerid}:${fixture.rawPayload.context.market.timeframe}`;
    const pipeline = buildPipelineReadModel(marketKey);
    const review = buildStoredPostPlanReview(marketKey);
    const marketPipelineReadModelRepository =
      new InMemoryMarketPipelineReadModelRepository(pipeline);
    const postPlanReviewRepository = new InMemoryPostPlanReviewRepository(review);
    const memoryLessonCandidateRepository =
      new InMemoryMemoryLessonCandidateRepository();
    const agentRunRepository = new InMemoryAgentRunRepository();

    const handler = createMemoryCurateHandler(
      {
        postPlanReviewRepository,
        marketPipelineReadModelRepository,
        memoryLessonCandidateRepository,
        agentRunRepository
      },
      { PLANNER_RUNTIME: "deterministic" } satisfies NodeJS.ProcessEnv
    );

    const result = await handler(
      {
        id: "job-1",
        jobType: "memory_curate",
        status: "running",
        market: fixture.market,
        symbol: fixture.symbol,
        timeframe: fixture.timeframe,
        signalId: null,
        planId: review.planId,
        priority: 1,
        idempotencyKey: "memory_curate:test",
        payloadJson: {
          postPlanReviewId: review.id,
          trigger: "post_plan_review"
        },
        resultRefJson: null,
        lockedBy: "hermes-test",
        lockedAt: "2026-05-25T16:30:00.000Z",
        lockedUntil: "2026-05-25T16:31:00.000Z",
        attemptCount: 0,
        maxAttempts: 2,
        runAfter: "2026-05-25T16:29:00.000Z",
        lastError: null,
        createdAt: "2026-05-25T16:29:00.000Z",
        updatedAt: "2026-05-25T16:30:00.000Z"
      },
      {
        now: () => "2026-05-25T16:30:01.000Z",
        logger: console
      }
    );

    expect(result).toMatchObject({
      jobType: "memory_curate",
      marketKey,
      postPlanReviewId: review.id,
      memoryLessonCandidateCount: 1
    });
    expect(agentRunRepository.runs).toHaveLength(1);
    expect(agentRunRepository.runs[0]?.operation).toBe("memory.curate");
    expect(agentRunRepository.runs[0]?.skillName).toBe(
      "curate_memory_lesson_candidates.crypto"
    );
    expect(agentRunRepository.runs[0]?.promptVersion).toBe(
      "deterministic-memory-lessons-v1:crypto"
    );
    expect(memoryLessonCandidateRepository.candidates).toHaveLength(1);
    expect(memoryLessonCandidateRepository.candidates[0]?.status).toBe(
      "pending_review"
    );
    expect(memoryLessonCandidateRepository.candidates[0]?.scopeMarket).toBe("crypto");
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
  constructor(readonly review: StoredPostPlanReview) {}

  async getPostPlanReviewById(
    reviewId: string
  ): Promise<StoredPostPlanReview | null> {
    return this.review.id === reviewId ? this.review : null;
  }

  async recordPostPlanReview(): Promise<StoredPostPlanReview> {
    return this.review;
  }

  async getLatestPostPlanReviewByPlanId(
    planId: string
  ): Promise<StoredPostPlanReview | null> {
    return this.review.planId === planId ? this.review : null;
  }

  async listPostPlanReviewsByPlanId(
    planId: string
  ): Promise<StoredPostPlanReview[]> {
    return this.review.planId === planId ? [this.review] : [];
  }
}

class InMemoryMemoryLessonCandidateRepository
  implements MemoryLessonCandidateRepository
{
  candidates: StoredMemoryLessonCandidate[] = [];

  async recordMemoryLessonCandidate(
    candidate: ReceivedMemoryLessonCandidate
  ): Promise<StoredMemoryLessonCandidate> {
    const stored = {
      id: `candidate-${this.candidates.length + 1}`,
      ...candidate
    };
    this.candidates.push(stored);
    return stored;
  }

  async listMemoryLessonCandidatesByPostPlanReviewId(
    postPlanReviewId: string
  ): Promise<StoredMemoryLessonCandidate[]> {
    return this.candidates.filter(
      (candidate) => candidate.postPlanReviewId === postPlanReviewId
    );
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

function buildStoredPostPlanReview(marketKey: string): StoredPostPlanReview {
  return {
    id: "review-1",
    planId: "plan-1",
    tradePlanVersionId: "tpv-1",
    marketKey,
    sourceEventKey: "evt-1",
    outcomeSummary: "The plan respected structure and the exit logic was orderly.",
    whatWorked: ["Pullback entry aligned with the trend."],
    whatFailed: ["No material failure surfaced in this sample."],
    missedContext: [],
    earlyWarningSignals: [],
    lessonCandidates: ["Pullback continuation setups in aligned crypto trends remained preferable to immediate chase entries."],
    shouldUpdateStrategyMemory: true,
    agentRunId: "run-review-1",
    createdAt: "2026-05-25T16:20:00.000Z"
  };
}

function buildPipelineReadModel(marketKey: string): MarketPipelineReadModel {
  return {
    marketKey,
    marketState: {
      id: "ms-1",
      marketKey,
      tickerid: "BINANCE:BTCUSDT",
      timeframe: "240",
      barTimeMs: 1710000000000,
      webhookEventId: "we-1",
      context: {
        market: {
          tickerid: "BINANCE:BTCUSDT",
          source: "BINANCE",
          timeframe: "240",
          timeframe_label: "4H"
        },
        bar: {
          index: 100,
          time_ms: 1710000000000,
          open: 100,
          high: 104,
          low: 99,
          close: 103,
          volume: 1000
        },
        volatility: { atr: 2.4, atr_len: 14 },
        regime: { name: "trend", trend_score: 0.82 },
        structure: {
          ema20: 101,
          ema50: 99,
          ema100: 96,
          ema200: 90,
          relative_high: 104,
          relative_low: 99
        },
        momentum: { value: 0.7, direction: "up", sqz: "released" },
        osc: { fast: 0.6, slow: 0.4, spread: 0.2, direction: "up" }
      },
      createdAt: "2026-05-25T16:00:00.000Z"
    },
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
    latestOrder: null,
    latestFill: null,
    currentPosition: null
  };
}
