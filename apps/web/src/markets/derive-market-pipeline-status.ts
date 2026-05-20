import type { MarketPipelineReadModel } from "@big-banana/domain";

export const marketPipelineStatuses = [
  "normalized",
  "plan_ready",
  "risk_approved",
  "risk_rejected",
  "intent_ready",
  "order_submitted",
  "order_terminal"
] as const;

export type MarketPipelineStatus = (typeof marketPipelineStatuses)[number];

export function deriveMarketPipelineStatus(
  snapshot: MarketPipelineReadModel
): MarketPipelineStatus {
  if (snapshot.latestOrder) {
    return isTerminalOrderState(snapshot.latestOrder.status)
      ? "order_terminal"
      : "order_submitted";
  }

  if (snapshot.executionIntent) {
    return "intent_ready";
  }

  if (snapshot.riskVerdict) {
    if (snapshot.riskVerdict.verdict === "reject") {
      return "risk_rejected";
    }

    return "risk_approved";
  }

  if (snapshot.tradePlanVersion) {
    return "plan_ready";
  }

  return "normalized";
}

function isTerminalOrderState(status: string): boolean {
  return (
    status === "filled" ||
    status === "canceled" ||
    status === "rejected" ||
    status === "reconciled_absent"
  );
}
