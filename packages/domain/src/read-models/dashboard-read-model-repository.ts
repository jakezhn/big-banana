export type DashboardOverviewReadModel = {
  signalsTodayCount: number;
  plansTodayCount: number;
  riskRejectsTodayCount: number;
  ordersSubmittedTodayCount: number;
  ordersFilledTodayCount: number;
  ordersCanceledTodayCount: number;
  openPositionsCount: number;
  interventionsTodayCount: number;
};

export type DashboardPipelineListItem = {
  marketKey: string;
  tickerid: string;
  timeframe: string;
  updatedAt: string;
  pipelineStatus:
    | "normalized"
    | "plan_ready"
    | "risk_approved"
    | "risk_rejected"
    | "intent_ready"
    | "order_submitted"
    | "order_terminal";
  tradePlanAction:
    | "create"
    | "keep"
    | "patch"
    | "terminate"
    | "skip"
    | null;
  riskVerdict: "approve" | "approve_with_reduction" | "reject" | null;
  latestOrderStatus: string | null;
};

export interface DashboardReadModelRepository {
  getOverview(): Promise<DashboardOverviewReadModel>;

  listRecentPipelines(limit: number): Promise<DashboardPipelineListItem[]>;
}
