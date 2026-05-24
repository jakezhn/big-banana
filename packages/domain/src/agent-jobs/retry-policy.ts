import type { StoredAgentJob } from "./agent-job-repository";

const DEFAULT_RETRY_BASE_MS = 5_000;
const DEFAULT_RETRY_MAX_MS = 300_000;

export function getAgentJobRetryBackoffMs(
  nextAttemptCount: number,
  baseMs = DEFAULT_RETRY_BASE_MS,
  maxMs = DEFAULT_RETRY_MAX_MS
): number {
  const safeAttemptCount = Math.max(1, nextAttemptCount);
  return Math.min(maxMs, baseMs * 2 ** (safeAttemptCount - 1));
}

export function shouldRetryAgentJob(job: StoredAgentJob): boolean {
  return job.attemptCount + 1 < job.maxAttempts;
}

export type AgentJobFailureState = {
  status: "pending" | "failed";
  attemptCount: number;
  runAfter: string;
  lastError: string;
};

export function buildAgentJobFailureState(
  job: StoredAgentJob,
  failedAt: string,
  errorMessage: string
): AgentJobFailureState {
  const nextAttemptCount = job.attemptCount + 1;

  if (nextAttemptCount >= job.maxAttempts) {
    return {
      status: "failed",
      attemptCount: nextAttemptCount,
      runAfter: failedAt,
      lastError: errorMessage
    };
  }

  return {
    status: "pending",
    attemptCount: nextAttemptCount,
    runAfter: new Date(
      Date.parse(failedAt) + getAgentJobRetryBackoffMs(nextAttemptCount)
    ).toISOString(),
    lastError: errorMessage
  };
}
