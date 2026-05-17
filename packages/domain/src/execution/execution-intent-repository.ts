import type { ExecutionIntent } from "@big-banana/contracts";

export type ReceivedExecutionIntent = {
  tradePlanVersionId: string;
  riskVerdictId: string;
  tradingAccountId: string;
  payload: ExecutionIntent;
  createdAt: string;
};

export type StoredExecutionIntent = ReceivedExecutionIntent & {
  id: string;
};

export interface ExecutionIntentRepository {
  recordExecutionIntent(
    intent: ReceivedExecutionIntent
  ): Promise<StoredExecutionIntent>;
}
