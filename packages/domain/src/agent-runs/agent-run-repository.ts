import type { JsonValue } from "../orders/order-repository";

export type AgentRunStatus = "success" | "invalid_output" | "failed";

export type ReceivedAgentRun = {
  marketKey: string;
  sourceEventKey: string;
  operation: string;
  runnerKind: string;
  model: string | null;
  status: AgentRunStatus;
  inputSummary: JsonValue;
  outputSummary: JsonValue | null;
  tradePlanVersionId: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
};

export type StoredAgentRun = ReceivedAgentRun & {
  id: string;
};

export interface AgentRunRepository {
  recordAgentRun(run: ReceivedAgentRun): Promise<StoredAgentRun>;
}
