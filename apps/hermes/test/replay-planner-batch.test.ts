import { describe, expect, it } from "vitest";
import type {
  AgentJobRepository,
  AgentJobType,
  EnqueueAgentJobInput,
  JsonValue,
  StoredAgentJob
} from "@big-banana/domain";
import { AgentJobWorker } from "../src/worker/agent-job-worker";
import type { AgentJobWorkerRunResult } from "../src/worker/agent-job-worker";
import type { HermesWorkerConfig } from "../src/config/get-hermes-worker-config-from-env";
import { runReplayPlannerBatch } from "../src/replay/replay-planner-batch";
import { defaultReplayPlannerFixtures } from "../src/replay/default-replay-planner-fixtures";

const baseConfig: HermesWorkerConfig = {
  workerId: "hermes-replay-batch-test",
  pollIntervalMs: 1,
  lockTtlSeconds: 30,
  jobTypes: ["replay_planner"],
  markets: undefined,
  tradingAccountId: "paper-tradingview"
};

describe("runReplayPlannerBatch", () => {
  it("enqueues fixtures, drives the worker, and summarizes completed replay jobs", async () => {
    const jobRepository = new InMemoryAgentJobRepository();
    const worker = new AgentJobWorker({
      jobRepository,
      config: baseConfig,
      handlers: {
        replay_planner: async (job) => ({
          fixtureId:
            typeof (job.payloadJson as Record<string, JsonValue>).fixtureId === "string"
              ? ((job.payloadJson as Record<string, JsonValue>).fixtureId as string)
              : null,
          jobType: "replay_planner",
          market: job.market,
          symbol: job.symbol,
          timeframe: job.timeframe,
          marketKey: `${job.symbol}:${job.timeframe}`,
          sourceEventKey: `${job.symbol}:${job.timeframe}:evt`,
          agentRunId: `run-${job.id}`,
          runnerKind: "deterministic",
          modelProvider: null,
          model: null,
          promptVersion: "replay-batch-v1",
          action: job.market === "commodity" ? "skip" : "create",
          executionState: job.market === "commodity" ? "watch" : "armed",
          riskTier: job.market === "commodity" ? "probe" : "standard",
          executionEligible: job.market === "commodity" ? false : true,
          tokenUsageJson: null
        })
      },
      now: createNow()
    });

    const result = await runReplayPlannerBatch(
      defaultReplayPlannerFixtures,
      { jobRepository, worker },
      {
        idempotencyPrefix: "batch-test",
        maxRuns: 20
      }
    );

    expect(result.totalFixtures).toBe(defaultReplayPlannerFixtures.length);
    expect(result.completedJobs).toHaveLength(defaultReplayPlannerFixtures.length);
    expect(result.failedJobs).toHaveLength(0);
    expect(result.pendingJobs).toHaveLength(0);
    expect(result.summary.totalRuns).toBe(defaultReplayPlannerFixtures.length);
    expect(result.summary.marketCounts.crypto).toBe(1);
    expect(result.summary.marketCounts.us_equity).toBe(1);
    expect(result.summary.marketCounts.commodity).toBe(1);
    expect(result.summary.actionCounts.create).toBe(2);
    expect(result.summary.actionCounts.skip).toBe(1);
    expect(result.summary.executionEligibleCount).toBe(2);
    expect(result.summary.executionIneligibleCount).toBe(1);
    expect(
      result.workerRuns.every(
        (run): run is Extract<AgentJobWorkerRunResult, { kind: "completed" }> =>
          run.kind === "completed"
      )
    ).toBe(true);
  });
});

class InMemoryAgentJobRepository implements AgentJobRepository {
  readonly jobs: StoredAgentJob[] = [];

  async enqueueJob(input: EnqueueAgentJobInput): Promise<StoredAgentJob> {
    const existing = this.jobs.find(
      (job) => job.idempotencyKey === input.idempotencyKey
    );

    if (existing) {
      return existing;
    }

    const createdAt = input.createdAt ?? "2026-05-25T00:00:00.000Z";
    const runAfter = input.runAfter ?? createdAt;
    const job: StoredAgentJob = {
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

    this.jobs.push(job);
    return job;
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
    jobTypes?: AgentJobType[];
  }): Promise<StoredAgentJob | null> {
    const now = input.now ?? "2026-05-25T00:00:00.000Z";
    const claimable = this.jobs.find(
      (job) =>
        job.status === "pending" &&
        job.runAfter <= now &&
        (input.jobTypes === undefined || input.jobTypes.includes(job.jobType))
    );

    if (!claimable) {
      return null;
    }

    const claimed = {
      ...claimable,
      status: "running" as const,
      lockedBy: input.workerId,
      lockedAt: now,
      lockedUntil: new Date(
        Date.parse(now) + input.lockTtlSeconds * 1000
      ).toISOString(),
      updatedAt: now
    };

    this.replaceJob(claimed);
    return claimed;
  }

  async markJobCompleted(
    jobId: string,
    workerId: string,
    completedAt: string,
    resultRefJson: JsonValue | null
  ): Promise<StoredAgentJob> {
    const existing = this.requireJob(jobId);
    const completed = {
      ...existing,
      status: "completed" as const,
      resultRefJson,
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
      updatedAt: completedAt
    };

    this.replaceJob(completed);
    return completed;
  }

  async reportJobFailure(
    jobId: string,
    _workerId: string,
    failedAt: string,
    errorMessage: string
  ): Promise<StoredAgentJob> {
    const existing = this.requireJob(jobId);
    const failed = {
      ...existing,
      status: "failed" as const,
      attemptCount: existing.attemptCount + 1,
      lastError: errorMessage,
      lockedBy: null,
      lockedAt: null,
      lockedUntil: null,
      updatedAt: failedAt
    };

    this.replaceJob(failed);
    return failed;
  }

  async requeueTimedOutJobs(): Promise<number> {
    return 0;
  }

  async cancelJob(jobId: string, cancelledAt: string): Promise<StoredAgentJob> {
    const existing = this.requireJob(jobId);
    const cancelled = {
      ...existing,
      status: "cancelled" as const,
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

function createNow(): () => string {
  let currentMs = Date.parse("2026-05-25T00:00:00.000Z");

  return () => {
    const value = new Date(currentMs).toISOString();
    currentMs += 1_000;
    return value;
  };
}
