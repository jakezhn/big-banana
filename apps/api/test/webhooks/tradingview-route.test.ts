import { describe, expect, it } from "vitest";
import { contractFixture } from "../../../../packages/domain/test/helpers.js";
import { AgentJobWorker } from "../../../hermes/src/worker/agent-job-worker.js";
import { createGeneratePlanHandler } from "../../../hermes/src/worker/planning/generate-plan-handler.js";
import {
  type AgentRunRepository,
  type AgentJobRepository,
  type ExecutionIntentRepository,
  type ReceivedAgentRun,
  type EnqueueAgentJobInput,
  type ReceivedOrder,
  type ReceivedOrderStatusUpdate,
  type ReceivedExecutionIntent,
  type ReceivedMarketState,
  type ReceivedPlanTransition,
  type ReceivedPositionHistoryEntry,
  type ReceivedPositionSnapshot,
  type ReceivedRiskVerdict,
  type ReceivedTradePlanVersion,
  type ReceivedWebhookEvent,
  type RiskPolicySnapshot,
  type RiskVerdictRepository,
  type StoredExecutionIntent,
  type StoredAgentRun,
  type StoredAgentJob,
  type StoredMarketState,
  type StoredOrder,
  type StoredPlanTransition,
  type StoredPositionHistoryEntry,
  type StoredPositionSnapshot,
  type StoredRiskVerdict,
  type StoredTradePlanVersion,
  type StoredWebhookEvent,
  type TradePlanVersionRepository,
  type WebhookEventRepository
} from "@big-banana/domain";
import type { PipelineMode } from "../../src/trading/get-pipeline-mode-from-env.js";
import { handleTradingViewWebhookRequest } from "../../src/webhooks/tradingview/handle-tradingview-webhook-request.js";

function request(body: string, contentType = "application/json"): Request {
  return new Request("http://localhost/api/webhooks/tradingview", {
    method: "POST",
    headers: {
      "content-type": contentType
    },
    body
  });
}

const manualReviewPolicy: RiskPolicySnapshot = {
  tradingAccountId: "acct-1",
  accountEquity: 20000,
  maxTradeRiskPct: 0.5,
  maxNotional: 100000,
  maxLeverage: 3,
  dailyLossLimitBreached: false,
  consecutiveLossLimitBreached: false,
  killSwitchEnabled: false,
  liveRequiresManualApproval: false
};

class InMemoryWebhookEventRepository implements WebhookEventRepository {
  readonly events = new Map<string, StoredWebhookEvent>();

  async recordReceivedEvent(
    event: ReceivedWebhookEvent
  ): Promise<StoredWebhookEvent> {
    const existing = this.events.get(event.deliveryKey);

    if (existing) {
      const duplicate = {
        ...existing,
        lastReceivedAt: event.receivedAt,
        deliveryCount: existing.deliveryCount + 1,
        duplicate: true
      };

      this.events.set(event.deliveryKey, duplicate);
      return duplicate;
    }

    const stored = {
      ...event,
      id: crypto.randomUUID(),
      lastReceivedAt: event.receivedAt,
      deliveryCount: 1,
      duplicate: false,
      processStatus: "received"
    };

    this.events.set(event.deliveryKey, stored);
    return stored;
  }

  async updateProcessStatus(
    webhookEventId: string,
    processStatus: string
  ): Promise<void> {
    for (const [deliveryKey, event] of this.events.entries()) {
      if (event.id !== webhookEventId) {
        continue;
      }

      this.events.set(deliveryKey, { ...event, processStatus });
      return;
    }

    throw new Error(`Unknown webhook event: ${webhookEventId}`);
  }
}

class InMemoryMarketStateRepository implements MarketStateRepository {
  readonly states: StoredMarketState[] = [];

  async recordMarketState(
    state: ReceivedMarketState
  ): Promise<StoredMarketState> {
    const existing = this.states.find(
      (candidate) => candidate.marketKey === state.marketKey
    );
    const stored = {
      ...state,
      id: existing?.id ?? crypto.randomUUID()
    };

    if (!existing || state.barTimeMs >= existing.barTimeMs) {
      const index = this.states.findIndex(
        (candidate) => candidate.marketKey === state.marketKey
      );

      if (index >= 0) {
        this.states[index] = stored;
      } else {
        this.states.push(stored);
      }
    }

    return this.states.find((candidate) => candidate.marketKey === state.marketKey) as StoredMarketState;
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

class InMemoryTradePlanVersionRepository implements TradePlanVersionRepository {
  readonly versions = new Map<string, StoredTradePlanVersion[]>();
  readonly transitions: StoredPlanTransition[] = [];

  async getLatestTradePlanVersion(
    planId: string
  ): Promise<StoredTradePlanVersion | null> {
    return (this.versions.get(planId) ?? []).at(-1) ?? null;
  }

  async getLatestTradePlanVersionByMarketKey(
    marketKey: string
  ): Promise<StoredTradePlanVersion | null> {
    const versions = [...this.versions.values()]
      .flat()
      .filter((version) => version.marketKey === marketKey);

    return versions.at(-1) ?? null;
  }

  async recordTradePlanVersion(
    version: ReceivedTradePlanVersion
  ): Promise<StoredTradePlanVersion> {
    const stored = { ...version, id: crypto.randomUUID() };
    const versions = this.versions.get(version.planId) ?? [];
    versions.push(stored);
    this.versions.set(version.planId, versions);
    return stored;
  }

  async recordPlanTransition(
    transition: ReceivedPlanTransition
  ): Promise<StoredPlanTransition> {
    const stored = { ...transition, id: crypto.randomUUID() };
    this.transitions.push(stored);
    return stored;
  }
}

class InMemoryRiskVerdictRepository implements RiskVerdictRepository {
  readonly verdicts: StoredRiskVerdict[] = [];

  async recordRiskVerdict(
    verdict: ReceivedRiskVerdict
  ): Promise<StoredRiskVerdict> {
    const stored = { ...verdict, id: crypto.randomUUID() };
    this.verdicts.push(stored);
    return stored;
  }
}

class InMemoryExecutionIntentRepository implements ExecutionIntentRepository {
  readonly intents: StoredExecutionIntent[] = [];

  async recordExecutionIntent(
    intent: ReceivedExecutionIntent
  ): Promise<StoredExecutionIntent> {
    const stored = { ...intent, id: crypto.randomUUID() };
    this.intents.push(stored);
    return stored;
  }
}

class InMemoryAgentRunRepository implements AgentRunRepository {
  readonly runs: StoredAgentRun[] = [];

  async recordAgentRun(run: ReceivedAgentRun): Promise<StoredAgentRun> {
    const stored = { ...run, id: crypto.randomUUID() };
    this.runs.push(stored);
    return stored;
  }
}

class InMemoryAgentJobRepository implements AgentJobRepository {
  readonly jobs: StoredAgentJob[] = [];

  async enqueueJob(input: EnqueueAgentJobInput): Promise<StoredAgentJob> {
    const existing = this.jobs.find(
      (job) => job.idempotencyKey === input.idempotencyKey
    );

    if (existing) {
      return existing;
    }

    const createdAt = input.createdAt ?? "2026-05-24T10:00:00.000Z";
    const runAfter = input.runAfter ?? createdAt;
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
      runAfter,
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
    now: string;
    jobTypes: string[];
    markets?: string[];
  }): Promise<StoredAgentJob | null> {
    const claimable = this.jobs.find(
      (job) =>
        job.status === "pending" &&
        job.runAfter <= input.now &&
        input.jobTypes.includes(job.jobType) &&
        (input.markets === undefined || input.markets.includes(job.market))
    );

    if (!claimable) {
      return null;
    }

    const lockedUntil = new Date(
      Date.parse(input.now) + input.lockTtlSeconds * 1000
    ).toISOString();

    const claimed = {
      ...claimable,
      status: "running" as const,
      lockedBy: input.workerId,
      lockedAt: input.now,
      lockedUntil,
      updatedAt: input.now
    };

    this.replaceJob(claimed);
    return claimed;
  }

  async markJobCompleted(
    jobId: string,
    workerId: string,
    completedAt: string,
    resultRefJson: StoredAgentJob["resultRefJson"]
  ): Promise<StoredAgentJob> {
    const existing = this.requireJob(jobId);
    const completed = {
      ...existing,
      status: "completed" as const,
      resultRefJson,
      lockedBy: workerId,
      lockedAt: null,
      lockedUntil: null,
      updatedAt: completedAt
    };

    this.replaceJob(completed);
    return completed;
  }

  async reportJobFailure(
    jobId: string,
    workerId: string,
    failedAt: string,
    errorMessage: string
  ): Promise<StoredAgentJob> {
    const existing = this.requireJob(jobId);
    const attemptCount = existing.attemptCount + 1;
    const status =
      attemptCount >= existing.maxAttempts ? "failed" : "pending";
    const failed = {
      ...existing,
      status,
      attemptCount,
      lastError: errorMessage,
      lockedBy: workerId,
      lockedAt: null,
      lockedUntil: null,
      updatedAt: failedAt
    };

    this.replaceJob(failed);
    return failed;
  }

  async requeueTimedOutJobs(now: string): Promise<number> {
    let count = 0;

    this.jobs.splice(
      0,
      this.jobs.length,
      ...this.jobs.map((job) => {
        if (
          job.status !== "running" ||
          job.lockedUntil === null ||
          job.lockedUntil > now
        ) {
          return job;
        }

        count += 1;
        return {
          ...job,
          status: "pending" as const,
          attemptCount: Math.min(job.attemptCount + 1, job.maxAttempts),
          lockedBy: null,
          lockedAt: null,
          lockedUntil: null,
          updatedAt: now
        };
      })
    );

    return count;
  }

  async cancelJob(
    jobId: string,
    cancelledAt: string,
    reason: string
  ): Promise<StoredAgentJob> {
    const existing = this.requireJob(jobId);
    const cancelled = {
      ...existing,
      status: "cancelled" as const,
      lastError: reason,
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
      updatedAt: cancelledAt
    };

    this.replaceJob(cancelled);
    return cancelled;
  }

  private requireJob(jobId: string): StoredAgentJob {
    const existing = this.jobs.find((job) => job.id === jobId);

    if (!existing) {
      throw new Error(`Unknown agent job: ${jobId}`);
    }

    return existing;
  }

  private replaceJob(updated: StoredAgentJob): void {
    const index = this.jobs.findIndex((job) => job.id === updated.id);

    if (index < 0) {
      throw new Error(`Unknown agent job: ${updated.id}`);
    }

    this.jobs[index] = updated;
  }
}

class InMemoryOrderRepository implements OrderRepository {
  readonly orders: StoredOrder[] = [];

  async getLatestOrderByExecutionIntentId(
    executionIntentId: string
  ): Promise<StoredOrder | null> {
    return (
      this.orders
        .filter((order) => order.executionIntentId === executionIntentId)
        .at(-1) ?? null
    );
  }

  async getOpenOrdersByTradingAccountIdAndSymbol(
    tradingAccountId: string,
    symbol: string
  ): Promise<StoredOrder[]> {
    return this.orders.filter(
      (order) =>
        order.tradingAccountId === tradingAccountId &&
        order.symbol === symbol &&
        order.terminalAt === null &&
        order.status !== "preflight_failed" &&
        order.status !== "rejected"
    );
  }

  async recordOrder(order: ReceivedOrder): Promise<StoredOrder> {
    const stored = { ...order, id: crypto.randomUUID() };
    this.orders.push(stored);
    return stored;
  }

  async updateOrderStatus(
    orderId: string,
    update: ReceivedOrderStatusUpdate
  ): Promise<StoredOrder> {
    const index = this.orders.findIndex((order) => order.id === orderId);

    if (index < 0) {
      throw new Error(`Unknown order: ${orderId}`);
    }

    const stored = {
      ...this.orders[index],
      ...update
    };
    this.orders[index] = stored;
    return stored;
  }
}

class InMemoryPositionRepository implements PositionRepository {
  readonly current = new Map<string, StoredPositionSnapshot>();

  async getCurrentPosition(
    tradingAccountId: string,
    symbol: string
  ): Promise<StoredPositionSnapshot | null> {
    return this.current.get(`${tradingAccountId}:${symbol}`) ?? null;
  }

  async upsertCurrentPosition(
    position: ReceivedPositionSnapshot
  ): Promise<StoredPositionSnapshot> {
    const stored = {
      ...position,
      id: this.current.get(`${position.tradingAccountId}:${position.symbol}`)?.id ??
        crypto.randomUUID()
    };
    this.current.set(`${position.tradingAccountId}:${position.symbol}`, stored);
    return stored;
  }

  async recordPositionHistory(
    entry: ReceivedPositionHistoryEntry
  ): Promise<StoredPositionHistoryEntry> {
    return { ...entry, id: crypto.randomUUID() };
  }
}

function dependencies(
  overrides?: Partial<{
    riskPolicy: RiskPolicySnapshot;
    pipelineMode: PipelineMode;
  }>
) {
  return {
    webhookEventRepository: new InMemoryWebhookEventRepository(),
    marketStateRepository: new InMemoryMarketStateRepository(),
    tradePlanVersionRepository: new InMemoryTradePlanVersionRepository(),
    agentRunRepository: new InMemoryAgentRunRepository(),
    agentJobRepository: new InMemoryAgentJobRepository(),
    riskVerdictRepository: new InMemoryRiskVerdictRepository(),
    executionIntentRepository: new InMemoryExecutionIntentRepository(),
    orderRepository: new InMemoryOrderRepository(),
    positionRepository: new InMemoryPositionRepository(),
    riskPolicy: overrides?.riskPolicy ?? manualReviewPolicy,
    pipelineMode: overrides?.pipelineMode ?? "full"
  };
}

describe("POST /api/webhooks/tradingview", () => {
  it("accepts a valid snapshot payload and stores a normalized market state", async () => {
    const deps = dependencies();
    const response = await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("snapshot.valid.json"))),
      deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      event_key: "BINANCE:BTCUSDT:240:1778419200000:snapshot",
      duplicate: false,
      process_status: "normalized"
    });
    expect([...deps.webhookEventRepository.events.values()][0]?.processStatus).toBe(
      "normalized"
    );
    expect(deps.tradePlanVersionRepository.versions.size).toBe(0);
  });

  it("enqueues a valid signal payload for live planning by default", async () => {
    const deps = dependencies();
    await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("snapshot.valid.json"))),
      deps
    );

    const response = await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("signal.valid.json"))),
      deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      event_key: "BINANCE:BTCUSDT:240:1778404800000:signal",
      duplicate: false,
      process_status: "queued"
    });
    expect(deps.agentJobRepository.jobs).toHaveLength(1);
    expect(deps.agentJobRepository.jobs[0]?.jobType).toBe("generate_plan");
    expect([...deps.tradePlanVersionRepository.versions.values()].flat()).toHaveLength(0);
    expect(deps.agentRunRepository.runs).toHaveLength(0);
    expect(deps.riskVerdictRepository.verdicts).toHaveLength(0);
    expect(deps.executionIntentRepository.intents).toHaveLength(0);
    expect(deps.orderRepository.orders).toHaveLength(0);
  });

  it("marks a repeated signal delivery as duplicate without replaying downstream writes", async () => {
    const deps = dependencies();
    await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("snapshot.valid.json"))),
      deps
    );

    const body = JSON.stringify(contractFixture("signal.valid.json"));
    await handleTradingViewWebhookRequest(request(body), deps);
    const response = await handleTradingViewWebhookRequest(request(body), deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      event_key: "BINANCE:BTCUSDT:240:1778404800000:signal",
      duplicate: true,
      process_status: "queued"
    });
    expect(deps.agentJobRepository.jobs).toHaveLength(1);
    expect([...deps.tradePlanVersionRepository.versions.values()].flat()).toHaveLength(0);
    expect(deps.agentRunRepository.runs).toHaveLength(0);
    expect(deps.riskVerdictRepository.verdicts).toHaveLength(0);
    expect(deps.executionIntentRepository.intents).toHaveLength(0);
    expect(deps.orderRepository.orders).toHaveLength(0);
  });

  it("ignores the deprecated manual-review flag and still enqueues live planning", async () => {
    const deps = dependencies({
      riskPolicy: {
        ...manualReviewPolicy,
        liveRequiresManualApproval: true
      }
    });
    await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("snapshot.valid.json"))),
      deps
    );

    const response = await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("signal.valid.json"))),
      deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      event_key: "BINANCE:BTCUSDT:240:1778404800000:signal",
      duplicate: false,
      process_status: "queued"
    });
    expect(deps.agentJobRepository.jobs).toHaveLength(1);
    expect(deps.executionIntentRepository.intents).toHaveLength(0);
    expect(deps.orderRepository.orders).toHaveLength(0);
    expect(deps.agentRunRepository.runs).toHaveLength(0);
  });

  it("enqueues an advisory signal without directly mutating downstream facts", async () => {
    const deps = dependencies({
      pipelineMode: "advisory"
    });
    await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("snapshot.valid.json"))),
      deps
    );

    const response = await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("signal.valid.json"))),
      deps
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      accepted: true,
      event_key: "BINANCE:BTCUSDT:240:1778404800000:signal",
      duplicate: false,
      process_status: "queued"
    });
    expect(deps.agentJobRepository.jobs).toHaveLength(1);
    expect(deps.agentJobRepository.jobs[0]?.payloadJson).toMatchObject({
      pipelineMode: "advisory"
    });
    expect(deps.riskVerdictRepository.verdicts).toHaveLength(0);
    expect(deps.executionIntentRepository.intents).toHaveLength(0);
    expect(deps.orderRepository.orders).toHaveLength(0);
    expect(deps.agentRunRepository.runs).toHaveLength(0);
  });

  it("hands off a queued signal to the hermes worker and writes back live planning results", async () => {
    const deps = dependencies();
    await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("snapshot.valid.json"))),
      deps
    );

    const signalResponse = await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("signal.valid.json"))),
      deps
    );

    expect(signalResponse.status).toBe(200);
    expect(deps.agentJobRepository.jobs).toHaveLength(1);
    expect(deps.agentJobRepository.jobs[0]?.status).toBe("pending");
    expect([...deps.tradePlanVersionRepository.versions.values()].flat()).toHaveLength(0);

    const runAfter = deps.agentJobRepository.jobs[0]?.runAfter;
    expect(runAfter).toBeTruthy();
    const workerStartAt = new Date(
      Date.parse(runAfter as string) + 1000
    ).toISOString();
    const workerEndAt = new Date(
      Date.parse(runAfter as string) + 2000
    ).toISOString();

    const worker = new AgentJobWorker({
      jobRepository: deps.agentJobRepository,
      config: {
        workerId: "hermes-test",
        pollIntervalMs: 1,
        lockTtlSeconds: 30,
        jobTypes: ["generate_plan"],
        markets: undefined,
        tradingAccountId: deps.riskPolicy.tradingAccountId
      },
      handlers: {
        generate_plan: createGeneratePlanHandler(
          {
            webhookEventRepository: deps.webhookEventRepository,
            marketStateRepository: deps.marketStateRepository,
            tradePlanVersionRepository: deps.tradePlanVersionRepository,
            agentRunRepository: deps.agentRunRepository,
            riskVerdictRepository: deps.riskVerdictRepository,
            executionIntentRepository: deps.executionIntentRepository,
            orderRepository: deps.orderRepository,
            positionRepository: deps.positionRepository
          },
          { PLANNER_RUNTIME: "deterministic" } satisfies NodeJS.ProcessEnv
        )
      },
      now: (() => {
        const timestamps = [workerStartAt, workerStartAt, workerEndAt];
        let index = 0;
        return () => timestamps[Math.min(index++, timestamps.length - 1)]!;
      })()
    });

    const result = await worker.runOnce();

    expect(result).toMatchObject({
      kind: "completed",
      jobType: "generate_plan"
    });
    expect(deps.agentJobRepository.jobs[0]?.status).toBe("completed");
    expect(deps.agentJobRepository.jobs[0]?.resultRefJson).toMatchObject({
      processStatus: "order_submitted",
      pipelineMode: "full"
    });
    expect([...deps.webhookEventRepository.events.values()].find(
      (event) =>
        event.eventKey === "BINANCE:BTCUSDT:240:1778404800000:signal"
    )?.processStatus).toBe("order_submitted");
    expect([...deps.tradePlanVersionRepository.versions.values()].flat()).toHaveLength(1);
    expect(deps.agentRunRepository.runs).toHaveLength(1);
    expect(deps.riskVerdictRepository.verdicts).toHaveLength(1);
    expect(deps.executionIntentRepository.intents).toHaveLength(1);
    expect(deps.orderRepository.orders).toHaveLength(1);
  });

  it("rejects non-json content types", async () => {
    const response = await handleTradingViewWebhookRequest(
      request("{}", "text/plain"),
      dependencies()
    );

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({
      accepted: false,
      error: "invalid_content_type"
    });
  });

  it("rejects malformed json", async () => {
    const response = await handleTradingViewWebhookRequest(
      request("{"),
      dependencies()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      accepted: false,
      error: "invalid_json"
    });
  });

  it("rejects invalid payloads", async () => {
    const response = await handleTradingViewWebhookRequest(
      request(JSON.stringify(contractFixture("unknown-version.invalid.json"))),
      dependencies()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      accepted: false,
      error: "invalid_payload"
    });
  });
});
