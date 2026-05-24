import type { JsonValue } from "../orders/order-repository";

export const agentJobStatuses = [
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
  "timeout"
] as const;

export type AgentJobStatus = (typeof agentJobStatuses)[number];

export const agentJobTypes = [
  "analyze_market_context",
  "analyze_signal_context",
  "generate_plan",
  "revise_plan",
  "risk_review",
  "execution_review",
  "post_plan_review",
  "memory_curate",
  "replay_planner"
] as const;

export type AgentJobType = (typeof agentJobTypes)[number];

export type AgentJobMarket =
  | "global"
  | "crypto"
  | "us_equity"
  | "cn_equity"
  | "commodity"
  | "unknown";

export type ReceivedAgentJob = {
  jobType: AgentJobType;
  status: AgentJobStatus;
  market: AgentJobMarket;
  symbol: string | null;
  timeframe: string | null;
  signalId: string | null;
  planId: string | null;
  priority: number;
  idempotencyKey: string;
  payloadJson: JsonValue;
  resultRefJson: JsonValue | null;
  lockedBy: string | null;
  lockedAt: string | null;
  lockedUntil: string | null;
  attemptCount: number;
  maxAttempts: number;
  runAfter: string;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StoredAgentJob = ReceivedAgentJob & {
  id: string;
};

export type EnqueueAgentJobInput = {
  jobType: AgentJobType;
  market: AgentJobMarket;
  symbol?: string | null;
  timeframe?: string | null;
  signalId?: string | null;
  planId?: string | null;
  priority?: number;
  idempotencyKey: string;
  payloadJson: JsonValue;
  maxAttempts?: number;
  runAfter?: string;
  createdAt?: string;
};

export type ClaimNextAgentJobInput = {
  workerId: string;
  lockTtlSeconds: number;
  now?: string;
  jobTypes?: AgentJobType[];
  markets?: AgentJobMarket[];
};

export interface AgentJobRepository {
  enqueueJob(input: EnqueueAgentJobInput): Promise<StoredAgentJob>;

  getJobById(jobId: string): Promise<StoredAgentJob | null>;

  getJobByIdempotencyKey(idempotencyKey: string): Promise<StoredAgentJob | null>;

  claimNextJob(input: ClaimNextAgentJobInput): Promise<StoredAgentJob | null>;

  markJobCompleted(
    jobId: string,
    workerId: string,
    completedAt: string,
    resultRefJson: JsonValue | null
  ): Promise<StoredAgentJob>;

  reportJobFailure(
    jobId: string,
    workerId: string,
    failedAt: string,
    errorMessage: string
  ): Promise<StoredAgentJob>;

  requeueTimedOutJobs(now: string): Promise<number>;

  cancelJob(jobId: string, cancelledAt: string): Promise<StoredAgentJob>;
}
