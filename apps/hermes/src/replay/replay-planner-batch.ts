import {
  buildReplayPlannerJobInputFromFixture,
  summarizeReplayPlannerResultRefs,
  type ReplayPlannerFixture,
  type ReplayPlannerSummary
} from "./replay-planner-harness";
import type {
  AgentJobRepository,
  JsonValue,
  StoredAgentJob
} from "@big-banana/domain";
import { AgentJobWorker, type AgentJobWorkerRunResult } from "../worker/agent-job-worker";

export type ReplayPlannerBatchRunResult = {
  totalFixtures: number;
  completedJobs: StoredAgentJob[];
  failedJobs: StoredAgentJob[];
  cancelledJobs: StoredAgentJob[];
  pendingJobs: StoredAgentJob[];
  summary: ReplayPlannerSummary;
  workerRuns: AgentJobWorkerRunResult[];
};

export type ReplayPlannerBatchDependencies = {
  jobRepository: AgentJobRepository;
  worker: AgentJobWorker;
};

export async function runReplayPlannerBatch(
  fixtures: ReplayPlannerFixture[],
  dependencies: ReplayPlannerBatchDependencies,
  options: {
    priority?: number;
    maxAttempts?: number;
    createdAt?: string;
    idempotencyPrefix?: string;
    maxRuns?: number;
    maxIdleRuns?: number;
  } = {}
): Promise<ReplayPlannerBatchRunResult> {
  const enqueuedJobs = await Promise.all(
    fixtures.map((fixture) =>
      dependencies.jobRepository.enqueueJob(
        buildReplayPlannerJobInputFromFixture(fixture, {
          priority: options.priority,
          maxAttempts: options.maxAttempts,
          createdAt: options.createdAt,
          idempotencyPrefix: options.idempotencyPrefix
        })
      )
    )
  );

  const targetJobIds = new Set(enqueuedJobs.map((job) => job.id));
  const workerRuns: AgentJobWorkerRunResult[] = [];
  const maxRuns = options.maxRuns ?? Math.max(fixtures.length * 4, 20);
  const maxIdleRuns = options.maxIdleRuns ?? 3;
  let idleRuns = 0;

  for (let runIndex = 0; runIndex < maxRuns; runIndex += 1) {
    const result = await dependencies.worker.runOnce();
    workerRuns.push(result);

    if (result.kind === "idle") {
      idleRuns += 1;
    } else {
      idleRuns = 0;
    }

    const jobs = await Promise.all(
      [...targetJobIds].map((jobId) => dependencies.jobRepository.getJobById(jobId))
    );

    const trackedJobs = jobs.filter((job): job is StoredAgentJob => job !== null);
    const allTerminal = trackedJobs.every((job) =>
      job.status === "completed" ||
      job.status === "failed" ||
      job.status === "cancelled"
    );

    if (allTerminal && trackedJobs.length === targetJobIds.size) {
      return buildBatchRunResult(fixtures.length, trackedJobs, workerRuns);
    }

    if (idleRuns >= maxIdleRuns) {
      break;
    }
  }

  const finalJobs = await Promise.all(
    [...targetJobIds].map((jobId) => dependencies.jobRepository.getJobById(jobId))
  );

  return buildBatchRunResult(
    fixtures.length,
    finalJobs.filter((job): job is StoredAgentJob => job !== null),
    workerRuns
  );
}

function buildBatchRunResult(
  totalFixtures: number,
  jobs: StoredAgentJob[],
  workerRuns: AgentJobWorkerRunResult[]
): ReplayPlannerBatchRunResult {
  const completedJobs = jobs.filter((job) => job.status === "completed");
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const cancelledJobs = jobs.filter((job) => job.status === "cancelled");
  const pendingJobs = jobs.filter(
    (job) => job.status === "pending" || job.status === "running"
  );

  return {
    totalFixtures,
    completedJobs,
    failedJobs,
    cancelledJobs,
    pendingJobs,
    summary: summarizeReplayPlannerResultRefs(
      completedJobs
        .map((job) => job.resultRefJson)
        .filter((value): value is JsonValue => value !== null)
    ),
    workerRuns
  };
}
