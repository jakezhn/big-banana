import { describe, expect, it } from "vitest";
import {
  buildAgentJobFailureState,
  getAgentJobRetryBackoffMs,
  shouldRetryAgentJob,
  type StoredAgentJob
} from "../src/index.js";

function storedJob(overrides?: Partial<StoredAgentJob>): StoredAgentJob {
  return {
    id: "job-1",
    jobType: "generate_plan",
    status: "running",
    market: "crypto",
    symbol: "BTCUSDT",
    timeframe: "4H",
    signalId: "sig-1",
    planId: null,
    priority: 3,
    idempotencyKey: "crypto:BTCUSDT:4H:sig-1:generate_plan",
    payloadJson: { market: "crypto" },
    resultRefJson: null,
    lockedBy: "worker-1",
    lockedAt: "2026-05-24T00:00:00.000Z",
    lockedUntil: "2026-05-24T00:01:00.000Z",
    attemptCount: 0,
    maxAttempts: 3,
    runAfter: "2026-05-24T00:00:00.000Z",
    lastError: null,
    createdAt: "2026-05-24T00:00:00.000Z",
    updatedAt: "2026-05-24T00:00:00.000Z",
    ...overrides
  };
}

describe("agent job retry policy", () => {
  it("uses exponential backoff capped at a max duration", () => {
    expect(getAgentJobRetryBackoffMs(1)).toBe(5_000);
    expect(getAgentJobRetryBackoffMs(2)).toBe(10_000);
    expect(getAgentJobRetryBackoffMs(3)).toBe(20_000);
    expect(getAgentJobRetryBackoffMs(10)).toBe(300_000);
  });

  it("keeps failed jobs retryable until the final attempt", () => {
    expect(shouldRetryAgentJob(storedJob({ attemptCount: 0, maxAttempts: 3 }))).toBe(
      true
    );
    expect(shouldRetryAgentJob(storedJob({ attemptCount: 1, maxAttempts: 3 }))).toBe(
      true
    );
    expect(shouldRetryAgentJob(storedJob({ attemptCount: 2, maxAttempts: 3 }))).toBe(
      false
    );
  });

  it("requeues retryable failures with an incremented attempt count and delayed run_after", () => {
    const result = buildAgentJobFailureState(
      storedJob({ attemptCount: 0, maxAttempts: 3 }),
      "2026-05-24T00:00:00.000Z",
      "llm_timeout"
    );

    expect(result.status).toBe("pending");
    expect(result.attemptCount).toBe(1);
    expect(result.runAfter).toBe("2026-05-24T00:00:05.000Z");
    expect(result.lastError).toBe("llm_timeout");
  });

  it("marks the final failure as terminal", () => {
    const result = buildAgentJobFailureState(
      storedJob({ attemptCount: 2, maxAttempts: 3 }),
      "2026-05-24T00:00:00.000Z",
      "schema_validation_failed"
    );

    expect(result.status).toBe("failed");
    expect(result.attemptCount).toBe(3);
    expect(result.runAfter).toBe("2026-05-24T00:00:00.000Z");
    expect(result.lastError).toBe("schema_validation_failed");
  });
});
