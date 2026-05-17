import type { RiskVerdict } from "@big-banana/contracts";

export type ReceivedRiskVerdict = {
  tradePlanVersionId: string;
  tradingAccountId: string;
  verdict: RiskVerdict["verdict"];
  approvedRiskPct: RiskVerdict["approved_risk_pct"];
  approvedQty: RiskVerdict["approved_qty"];
  approvedNotional: RiskVerdict["approved_notional"];
  approvedStopPrice: RiskVerdict["approved_stop_price"];
  requireHumanApproval: RiskVerdict["require_human_approval"];
  checks: RiskVerdict["checks"];
  rejectionCodes: RiskVerdict["rejection_codes"];
  createdAt: string;
};

export type StoredRiskVerdict = ReceivedRiskVerdict & {
  id: string;
};

export interface RiskVerdictRepository {
  recordRiskVerdict(verdict: ReceivedRiskVerdict): Promise<StoredRiskVerdict>;
}
