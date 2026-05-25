import {
  buildMemoryCurateJobInput,
  buildPostPlanReviewJobInput,
  buildRevisePlanJobInput
} from "@big-banana/agent";
import {
  createDefaultAgentJobHandlers,
  type DefaultAgentJobHandlerDependencies
} from "../src/worker/create-default-agent-job-handlers";
import { AgentJobWorker } from "../src/worker/agent-job-worker";
import {
  normalizeTradingViewPayload,
  type AgentJobRepository,
  type AgentRunRepository,
  type EnqueueAgentJobInput,
  type ExecutionIntentRepository,
  type JsonValue,
  type MarketPipelineReadModel,
  type MarketPipelineReadModelRepository,
  type MarketStateRepository,
  type MemoryLessonCandidateRepository,
  type OrderRepository,
  type PlanRevisionSuggestionRepository,
  type PositionRepository,
  type PostPlanReviewRepository,
  type ReceivedAgentRun,
  type ReceivedExecutionIntent,
  type ReceivedMarketState,
  type ReceivedMemoryLessonCandidate,
  type ReceivedOrder,
  type ReceivedOrderStatusUpdate,
  type ReceivedPlanRevisionSuggestion,
  type ReceivedPositionHistoryEntry,
  type ReceivedPositionSnapshot,
  type ReceivedPostPlanReview,
  type ReceivedRiskVerdict,
  type ReceivedTradePlanVersion,
  type ReceivedWebhookEvent,
  type RiskVerdictRepository,
  type StoredAgentJob,
  type StoredAgentRun,
  type StoredExecutionIntent,
  type StoredMarketState,
  type StoredMemoryLessonCandidate,
  type StoredOrder,
  type StoredPlanTransition,
  type StoredPlanRevisionSuggestion,
  type StoredPositionHistoryEntry,
  type StoredPositionSnapshot,
  type StoredPostPlanReview,
  type StoredRiskVerdict,
  type StoredTradePlanVersion,
  type TradePlanVersionRepository,
  type WebhookEventRepository
} from "@big-banana/domain";
import { describe, expect, it } from "vitest";
import { defaultReplayPlannerFixtures } from "../src/replay/default-replay-planner-fixtures";
import type { HermesWorkerConfig } from "../src/config/get-hermes-worker-config-from-env";

describe("revision/review/memory worker smoke", () => {
  it("processes revise_plan, post_plan_review, and memory_curate jobs through the queue and worker loop", async () => {
    const fixture = defaultReplayPlannerFixtures[0]!;
    const envelope = normalizeTradingViewPayload(
      fixture.rawPayload,
      fixture.receivedAt
    );
    const marketKey = envelope.marketKey;
    const tradingAccountId = "paper-tradingview";

    const deps = createDependencies({
      marketKey,
      envelope,
      market: fixture.market,
      tradingAccountId
    });
    const handlers = createDefaultAgentJobHandlers(deps);
    const jobRepository = new InMemoryAgentJobRepository();

    const reviseJob = await jobRepository.enqueueJob(
      buildRevisePlanJobInput(
        {
          envelope,
          trigger: "signal"
        },
        {
          createdAt: "2026-05-25T17:00:00.000Z"
        }
      )
    );

    const reviseWorker = new AgentJobWorker({
      jobRepository,
      config: buildConfig("revise_plan", tradingAccountId),
      handlers,
      logger: console,
      now: () => "2026-05-25T17:00:01.000Z"
    });

    const reviseResult = await reviseWorker.runOnce();
    const completedReviseJob = await jobRepository.getJobById(reviseJob.id);

    expect(reviseResult).toMatchObject({ kind: "completed", jobType: "revise_plan" });
    expect(completedReviseJob?.status).toBe("completed");
    expect((completedReviseJob?.resultRefJson as Record<string, JsonValue>)?.revisionAction).toBe(
      "upgrade"
    );
    expect(deps.planRevisionSuggestionRepository.suggestions).toHaveLength(1);

    const reviewJob = await jobRepository.enqueueJob(
      buildPostPlanReviewJobInput(
        {
          marketKey,
          sourceEventKey: "evt-1",
          trigger: "terminal_order"
        },
        {
          market: fixture.market,
          symbol: fixture.symbol,
          timeframe: fixture.timeframe,
          createdAt: "2026-05-25T17:01:00.000Z"
        }
      )
    );

    const reviewWorker = new AgentJobWorker({
      jobRepository,
      config: buildConfig("post_plan_review", tradingAccountId),
      handlers,
      logger: console,
      now: () => "2026-05-25T17:01:01.000Z"
    });

    const reviewResult = await reviewWorker.runOnce();
    const completedReviewJob = await jobRepository.getJobById(reviewJob.id);

    expect(reviewResult).toMatchObject({
      kind: "completed",
      jobType: "post_plan_review"
    });
    expect(completedReviewJob?.status).toBe("completed");
    expect(deps.postPlanReviewRepository.reviews).toHaveLength(1);

    const reviewId = deps.postPlanReviewRepository.reviews[0]?.id;
    expect(reviewId).toBeTruthy();

    const memoryJob = await jobRepository.enqueueJob(
      buildMemoryCurateJobInput(
        {
          postPlanReviewId: reviewId as string,
          trigger: "post_plan_review"
        },
        {
          market: fixture.market,
          symbol: fixture.symbol,
          timeframe: fixture.timeframe,
          createdAt: "2026-05-25T17:02:00.000Z"
        }
      )
    );

    const memoryWorker = new AgentJobWorker({
      jobRepository,
      config: buildConfig("memory_curate", tradingAccountId),
      handlers,
      logger: console,
      now: () => "2026-05-25T17:02:01.000Z"
    });

    const memoryResult = await memoryWorker.runOnce();
    const completedMemoryJob = await jobRepository.getJobById(memoryJob.id);

    expect(memoryResult).toMatchObject({
      kind: "completed",
      jobType: "memory_curate"
    });
    expect(completedMemoryJob?.status).toBe("completed");
    expect(
      (completedMemoryJob?.resultRefJson as Record<string, JsonValue>)
        ?.memoryLessonCandidateCount
    ).toBe(1);
    expect(deps.memoryLessonCandidateRepository.candidates).toHaveLength(1);
    expect(deps.agentRunRepository.runs.map((run) => run.operation)).toEqual([
      "plan.revise",
      "plan.review",
      "memory.curate"
    ]);
  });
});

function buildConfig(
  jobType: HermesWorkerConfig["jobTypes"][number],
  tradingAccountId: string
): HermesWorkerConfig {
  return {
    workerId: "hermes-test",
    pollIntervalMs: 1,
    lockTtlSeconds: 30,
    jobTypes: [jobType],
    markets: undefined,
    tradingAccountId
  };
}

function createDependencies({
  marketKey,
  envelope,
  tradingAccountId
}: {
  marketKey: string;
  envelope: ReturnType<typeof normalizeTradingViewPayload>;
  market: string;
  tradingAccountId: string;
}): DefaultAgentJobHandlerDependencies & {
  planRevisionSuggestionRepository: InMemoryPlanRevisionSuggestionRepository;
  postPlanReviewRepository: InMemoryPostPlanReviewRepository;
  memoryLessonCandidateRepository: InMemoryMemoryLessonCandidateRepository;
  agentRunRepository: InMemoryAgentRunRepository;
} {
  const marketStateRepository = new InMemoryMarketStateRepository();
  marketStateRepository.seedState({
    marketKey,
    webhookEventId: "we-1",
    tickerid: envelope.context.market.tickerid,
    timeframe: envelope.context.market.timeframe,
    barTimeMs: envelope.barTimeMs,
    context: envelope.context,
    createdAt: envelope.receivedAt
  });

  const tradePlanVersionRepository = new InMemoryTradePlanVersionRepository();
  tradePlanVersionRepository.seedVersion({
    planId: "plan-1",
    version: 1,
    marketKey,
    sourceEventKey: "evt-1",
    action: "create",
    marketThesis: {
      bias: envelope.signal?.direction ?? "long",
      environment: "trend",
      htf_bias: "bull",
      mtf_bias: "bull",
      bias_confidence: 0.78,
      trend_end_score: 0.12,
      structure_summary: "Aligned trend structure remains intact.",
      key_levels: [
        {
          role: "support",
          price_ref: "EMA50",
          importance: "primary"
        }
      ]
    },
    executionPlaybook: {
      state: "watch",
      entry_style: "pullback",
      entry_zone: { low: 100, high: 102, source: "structure" },
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
    reasoningSummary: "Watch-mode pullback continuation plan.",
    evidence: ["aligned_signal", "trend_continuation"],
    createdAt: "2026-05-25T16:50:00.000Z"
  });

  return {
    webhookEventRepository: new NoopWebhookEventRepository(),
    marketStateRepository,
    marketPipelineReadModelRepository: new StaticMarketPipelineReadModelRepository(
      buildReviewablePipeline(marketKey)
    ),
    tradePlanVersionRepository,
    orderRepository: new InMemoryOrderRepository(),
    positionRepository: new InMemoryPositionRepository(),
    planRevisionSuggestionRepository:
      new InMemoryPlanRevisionSuggestionRepository(),
    postPlanReviewRepository: new InMemoryPostPlanReviewRepository(),
    memoryLessonCandidateRepository:
      new InMemoryMemoryLessonCandidateRepository(),
    agentRunRepository: new InMemoryAgentRunRepository(),
    riskVerdictRepository: new NoopRiskVerdictRepository(),
    executionIntentRepository: new NoopExecutionIntentRepository(),
    tradingAccountId
  };
}

class InMemoryAgentJobRepository implements AgentJobRepository {
  jobs: StoredAgentJob[] = [];

  async enqueueJob(input: EnqueueAgentJobInput): Promise<StoredAgentJob> {
    const existing = this.jobs.find(
      (job) => job.idempotencyKey === input.idempotencyKey
    );

    if (existing) {
      return existing;
    }

    const createdAt = input.createdAt ?? "2026-05-25T17:00:00.000Z";
    const stored: StoredAgentJob = {
      id: crypto.randomUUID(),
      jobType: input.jobType,
      status: "pending",
      market: input.market,
      symbol: input.symbol ?? null,
      timeframe: input.timeframe ?? null,
      signalId: input.signalId ?? null,
      planId: input.planId ?? null,
      priority: input.priority ?? 5,
      idempotencyKey: input.idempotencyKey,
      payloadJson: input.payloadJson,
      resultRefJson: null,
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
      attemptCount: 0,
      maxAttempts: input.maxAttempts ?? 3,
      runAfter: input.runAfter ?? createdAt,
      lastError: null,
      createdAt,
      updatedAt: createdAt
    };

    this.jobs.push(stored);
    return stored;
  }

  async getJobById(jobId: string): Promise<StoredAgentJob | null> {
    return this.jobs.find((job) => job.id === jobId) ?? null;
  }

  async getJobByIdempotencyKey(
    idempotencyKey: string
  ): Promise<StoredAgentJob | null> {
    return this.jobs.find((job) => job.idempotencyKey === idempotencyKey) ?? null;
  }

  async claimNextJob(input: {
    workerId: string;
    lockTtlSeconds: number;
    now?: string;
    jobTypes?: StoredAgentJob["jobType"][];
    markets?: StoredAgentJob["market"][];
  }): Promise<StoredAgentJob | null> {
    const now = input.now ?? new Date().toISOString();
    const next = this.jobs.find(
      (job) =>
        job.status === "pending" &&
        (!input.jobTypes || input.jobTypes.includes(job.jobType)) &&
        (!input.markets || input.markets.includes(job.market))
    );

    if (!next) {
      return null;
    }

    next.status = "running";
    next.lockedBy = input.workerId;
    next.lockedAt = now;
    next.lockedUntil = new Date(
      Date.parse(now) + input.lockTtlSeconds * 1000
    ).toISOString();
    next.updatedAt = now;
    return next;
  }

  async markJobCompleted(
    jobId: string,
    workerId: string,
    completedAt: string,
    resultRefJson: JsonValue | null
  ): Promise<StoredAgentJob> {
    const job = this.jobs.find((entry) => entry.id === jobId);

    if (!job) {
      throw new Error(`Unknown job: ${jobId}`);
    }

    job.status = "completed";
    job.lockedBy = workerId;
    job.lockedUntil = completedAt;
    job.resultRefJson = resultRefJson;
    job.updatedAt = completedAt;
    return job;
  }

  async reportJobFailure(
    jobId: string,
    workerId: string,
    failedAt: string,
    errorMessage: string
  ): Promise<StoredAgentJob> {
    const job = this.jobs.find((entry) => entry.id === jobId);

    if (!job) {
      throw new Error(`Unknown job: ${jobId}`);
    }

    job.status = "failed";
    job.lockedBy = workerId;
    job.lastError = errorMessage;
    job.attemptCount += 1;
    job.updatedAt = failedAt;
    return job;
  }

  async requeueTimedOutJobs(): Promise<number> {
    return 0;
  }

  async cancelJob(jobId: string, cancelledAt: string): Promise<StoredAgentJob> {
    const job = this.jobs.find((entry) => entry.id === jobId);

    if (!job) {
      throw new Error(`Unknown job: ${jobId}`);
    }

    job.status = "cancelled";
    job.updatedAt = cancelledAt;
    return job;
  }
}

class NoopWebhookEventRepository implements WebhookEventRepository {
  async recordReceivedEvent(event: ReceivedWebhookEvent) {
    return {
      ...event,
      id: "we-1",
      lastReceivedAt: event.receivedAt,
      deliveryCount: 1,
      duplicate: false,
      processStatus: "received"
    };
  }

  async updateProcessStatus(): Promise<void> {}
}

class InMemoryMarketStateRepository implements MarketStateRepository {
  states: StoredMarketState[] = [];

  seedState(state: ReceivedMarketState): void {
    this.states.push({ id: `ms-${this.states.length + 1}`, ...state });
  }

  async recordMarketState(state: ReceivedMarketState): Promise<StoredMarketState> {
    const stored = { id: `ms-${this.states.length + 1}`, ...state };
    this.states.push(stored);
    return stored;
  }

  async getLatestStatesByTickerid(tickerid: string): Promise<StoredMarketState[]> {
    return this.states.filter((state) => state.tickerid === tickerid);
  }

  async getRecentMarketStatesByMarketKey(
    marketKey: string,
    limit: number
  ): Promise<StoredMarketState[]> {
    return this.states.filter((state) => state.marketKey === marketKey).slice(-limit);
  }
}

class StaticMarketPipelineReadModelRepository
  implements MarketPipelineReadModelRepository
{
  constructor(private readonly pipeline: MarketPipelineReadModel) {}

  async getLatestMarketPipeline(
    marketKey: string
  ): Promise<MarketPipelineReadModel | null> {
    return this.pipeline.marketKey === marketKey ? this.pipeline : null;
  }
}

class InMemoryTradePlanVersionRepository implements TradePlanVersionRepository {
  versions: StoredTradePlanVersion[] = [];
  transitions: StoredPlanTransition[] = [];

  seedVersion(version: ReceivedTradePlanVersion): void {
    this.versions.push({ id: `tpv-${this.versions.length + 1}`, ...version });
  }

  async getLatestTradePlanVersion(
    planId: string
  ): Promise<StoredTradePlanVersion | null> {
    return this.versions.filter((version) => version.planId === planId).at(-1) ?? null;
  }

  async getLatestTradePlanVersionByMarketKey(
    marketKey: string
  ): Promise<StoredTradePlanVersion | null> {
    return this.versions.filter((version) => version.marketKey === marketKey).at(-1) ?? null;
  }

  async recordTradePlanVersion(
    version: ReceivedTradePlanVersion
  ): Promise<StoredTradePlanVersion> {
    const stored = { id: `tpv-${this.versions.length + 1}`, ...version };
    this.versions.push(stored);
    return stored;
  }

  async recordPlanTransition(transition: {
    planId: string;
    version: number;
    fromState: any;
    toState: any;
    reasonCode: string;
    createdAt: string;
  }) {
    const stored = { id: `pt-${this.transitions.length + 1}`, ...transition };
    this.transitions.push(stored);
    return stored;
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

  async updateOrderStatus(
    _orderId: string,
    update: ReceivedOrderStatusUpdate
  ): Promise<StoredOrder> {
    return {
      id: crypto.randomUUID(),
      executionIntentId: "intent-1",
      tradingAccountId: "paper-tradingview",
      venue: "paper",
      symbol: "BINANCE:BTCUSDT",
      side: "buy",
      orderType: "limit",
      timeInForce: "GTC",
      reduceOnly: false,
      clientOrderId: "coid-1",
      exchangeOrderId: null,
      requestedQty: 1,
      requestedPrice: 100,
      stopPrice: null,
      submittedAt: update.lastExchangeUpdateAt,
      ...update
    };
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
    const stored = {
      id: `revision-${this.suggestions.length + 1}`,
      ...suggestion
    };
    this.suggestions.push(stored);
    return stored;
  }

  async getLatestPlanRevisionSuggestionByPlanId(
    planId: string
  ): Promise<StoredPlanRevisionSuggestion | null> {
    return this.suggestions.filter((s) => s.planId === planId).at(-1) ?? null;
  }

  async listPlanRevisionSuggestionsByPlanId(
    planId: string
  ): Promise<StoredPlanRevisionSuggestion[]> {
    return this.suggestions.filter((s) => s.planId === planId);
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
    const stored = { id: `review-${this.reviews.length + 1}`, ...review };
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
    const stored = { id: `run-${this.runs.length + 1}`, ...run };
    this.runs.push(stored);
    return stored;
  }
}

class NoopRiskVerdictRepository implements RiskVerdictRepository {
  async recordRiskVerdict(
    verdict: ReceivedRiskVerdict
  ): Promise<StoredRiskVerdict> {
    return { id: crypto.randomUUID(), ...verdict };
  }
}

class NoopExecutionIntentRepository implements ExecutionIntentRepository {
  async recordExecutionIntent(
    intent: ReceivedExecutionIntent
  ): Promise<StoredExecutionIntent> {
    return { id: crypto.randomUUID(), ...intent };
  }
}

function buildReviewablePipeline(marketKey: string): MarketPipelineReadModel {
  return {
    marketKey,
    marketState: {
      id: "ms-pipeline-1",
      marketKey,
      webhookEventId: "we-1",
      tickerid: "BINANCE:BTCUSDT",
      timeframe: "240",
      barTimeMs: 1778404800000,
      context: {
        market: {
          tickerid: "BINANCE:BTCUSDT",
          source: "BINANCE",
          timeframe: "240",
          timeframe_label: "4h"
        },
        bar: {
          index: 12345,
          time_ms: 1778404800000,
          open: 67000,
          high: 67009,
          low: 66995,
          close: 67004,
          volume: 12345.6
        },
        volatility: { atr: 3.2, atr_len: 14 },
        regime: { name: "Bull Pullback", trend_score: 5.8 },
        structure: {
          ema20: 67003,
          ema50: 67001,
          ema100: 66998,
          ema200: 66994,
          relative_high: 67016,
          relative_low: 66992
        },
        momentum: { value: 18.2, direction: "bull", sqz: "off" },
        osc: { fast: 54.1, slow: 48.6, spread: 5.5, direction: "bull" }
      },
      createdAt: "2026-05-25T16:00:00.000Z"
    },
    tradePlanVersion: {
      id: "tpv-review-1",
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
        entry_zone: { low: 100, high: 102, source: "structure" },
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
