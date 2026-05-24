import type {
  AgentJobRepository,
  AgentJobType,
  JsonValue,
  StoredAgentJob
} from "@big-banana/domain";
import { describe, expect, it, vi } from "vitest";
import type { HermesWorkerConfig } from "../src/config/get-hermes-worker-config-from-env";
import { AgentJobWorker } from "../src/worker/agent-job-worker";

const baseConfig: HermesWorkerConfig = {
  workerId: "hermes-test",
  pollIntervalMs: 1,
  lockTtlSeconds: 30,
  jobTypes: ["replay_planner"],
  markets: undefined
};

describe("AgentJobWorker", () => {
  it("returns idle when no claimable job exists", async () => {
    const repository = createRepository();
    const worker = new AgentJobWorker({
      jobRepository: repository,
      config: baseConfig,
      handlers: {}
    });

    const result = await worker.runOnce();

    expect(result).toEqual({ kind: "idle", requeuedTimedOutJobs: 0 });
    expect(repository.requeueTimedOutJobs).toHaveBeenCalledTimes(1);
    expect(repository.claimNextJob).toHaveBeenCalledTimes(1);
  });

  it("marks a claimed job completed when handler succeeds", async () => {
    const claimedJob = buildJob("replay_planner");
    const repository = createRepository({ claimedJob });
    const worker = new AgentJobWorker({
      jobRepository: repository,
      config: baseConfig,
      handlers: {
        replay_planner: async () => ({ ok: true })
      },
      now: () => "2026-05-24T08:00:00.000Z"
    });

    const result = await worker.runOnce();

    expect(result).toMatchObject({
      kind: "completed",
      jobId: claimedJob.id,
      jobType: claimedJob.jobType
    });
    expect(repository.markJobCompleted).toHaveBeenCalledWith(
      claimedJob.id,
      baseConfig.workerId,
      "2026-05-24T08:00:00.000Z",
      { ok: true }
    );
  });

  it("reports failure when no handler is registered", async () => {
    const claimedJob = buildJob("generate_plan");
    const repository = createRepository({ claimedJob });
    const worker = new AgentJobWorker({
      jobRepository: repository,
      config: { ...baseConfig, jobTypes: ["generate_plan"] },
      handlers: {},
      now: () => "2026-05-24T08:00:00.000Z"
    });

    const result = await worker.runOnce();

    expect(result).toMatchObject({
      kind: "failed",
      jobId: claimedJob.id,
      jobType: claimedJob.jobType
    });
    expect(repository.reportJobFailure).toHaveBeenCalledWith(
      claimedJob.id,
      baseConfig.workerId,
      "2026-05-24T08:00:00.000Z",
      "No Hermes handler registered for job type generate_plan"
    );
  });

  it("reports failure when handler throws", async () => {
    const claimedJob = buildJob("replay_planner");
    const repository = createRepository({ claimedJob });
    const worker = new AgentJobWorker({
      jobRepository: repository,
      config: baseConfig,
      handlers: {
        replay_planner: async () => {
          throw new Error("boom");
        }
      },
      now: () => "2026-05-24T08:00:00.000Z"
    });

    const result = await worker.runOnce();

    expect(result).toMatchObject({
      kind: "failed",
      jobId: claimedJob.id,
      jobType: claimedJob.jobType,
      errorMessage: "boom"
    });
    expect(repository.reportJobFailure).toHaveBeenCalledWith(
      claimedJob.id,
      baseConfig.workerId,
      "2026-05-24T08:00:00.000Z",
      "boom"
    );
  });
});

function createRepository({
  claimedJob = null
}: {
  claimedJob?: StoredAgentJob | null;
} = {}): AgentJobRepository {
  return {
    enqueueJob: vi.fn(),
    getJobById: vi.fn(),
    getJobByIdempotencyKey: vi.fn(),
    claimNextJob: vi.fn().mockResolvedValue(claimedJob),
    markJobCompleted: vi.fn().mockImplementation(async (_jobId, _workerId, _completedAt, resultRefJson) => ({
      ...claimedJob!,
      status: "completed",
      resultRefJson
    })),
    reportJobFailure: vi.fn().mockImplementation(async (_jobId, _workerId, failedAt, errorMessage) => ({
      ...claimedJob!,
      status: "failed",
      attemptCount: claimedJob ? claimedJob.attemptCount + 1 : 1,
      lastError: errorMessage,
      updatedAt: failedAt
    })),
    requeueTimedOutJobs: vi.fn().mockResolvedValue(0),
    cancelJob: vi.fn()
  };
}

function buildJob(jobType: AgentJobType): StoredAgentJob {
  return {
    id: "job-1",
    jobType,
    status: "running",
    market: "crypto",
    symbol: "BTCUSDT",
    timeframe: "240",
    signalId: "sig-1",
    planId: null,
    priority: 1,
    idempotencyKey: `crypto:BTCUSDT:240:${jobType}`,
    payloadJson: { source: "test" } satisfies JsonValue,
    resultRefJson: null,
    lockedBy: "hermes-test",
    lockedAt: "2026-05-24T07:59:00.000Z",
    lockedUntil: "2026-05-24T08:01:00.000Z",
    attemptCount: 0,
    maxAttempts: 3,
    runAfter: "2026-05-24T07:58:00.000Z",
    lastError: null,
    createdAt: "2026-05-24T07:58:00.000Z",
    updatedAt: "2026-05-24T07:59:00.000Z"
  };
}
