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

export type DashboardAgentRunListItem = {
  id: string;
  marketKey: string;
  sourceEventKey: string;
  operation: string;
  runnerKind: string;
  model: string | null;
  status: "success" | "invalid_output" | "failed";
  tradePlanVersionId: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
};

export interface DashboardReadModelRepository {
  getOverview(): Promise<DashboardOverviewReadModel>;

  listRecentPipelines(limit: number): Promise<DashboardPipelineListItem[]>;

  listRecentAgentRuns(limit: number): Promise<DashboardAgentRunListItem[]>;
}
