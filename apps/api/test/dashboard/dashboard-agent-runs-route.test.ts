import { describe, expect, it } from "vitest";
import type {
  DashboardAgentRunListItem,
  DashboardOverviewReadModel,
  DashboardPipelineListItem,
  DashboardReadModelRepository
} from "@big-banana/domain";
import { handleListDashboardAgentRunsRequest } from "../../src/dashboard/handle-list-dashboard-agent-runs-request";

class InMemoryDashboardReadModelRepository
  implements DashboardReadModelRepository
{
  constructor(
    private readonly agentRuns: DashboardAgentRunListItem[],
    private readonly overview: DashboardOverviewReadModel = {
      signalsTodayCount: 0,
      plansTodayCount: 0,
      riskRejectsTodayCount: 0,
      ordersSubmittedTodayCount: 0,
      ordersFilledTodayCount: 0,
      ordersCanceledTodayCount: 0,
      openPositionsCount: 0,
      interventionsTodayCount: 0
    },
    private readonly pipelines: DashboardPipelineListItem[] = []
  ) {}

  async getOverview(): Promise<DashboardOverviewReadModel> {
    return this.overview;
  }

  async listRecentPipelines(limit: number): Promise<DashboardPipelineListItem[]> {
    return this.pipelines.slice(0, limit);
  }

  async listRecentAgentRuns(limit: number): Promise<DashboardAgentRunListItem[]> {
    return this.agentRuns.slice(0, limit);
  }
}

function request(limit?: string): Request {
  const suffix = limit ? `?limit=${encodeURIComponent(limit)}` : "";
  return new Request(`http://localhost/api/dashboard/agent-runs${suffix}`);
}

describe("GET /api/dashboard/agent-runs", () => {
  it("returns recent agent runs using the provided limit", async () => {
    const repository = new InMemoryDashboardReadModelRepository([
      {
        id: "run-1",
        marketKey: "BINANCE:BTCUSDT:240",
        sourceEventKey: "event-1",
        operation: "plan.generate",
        runnerKind: "deterministic",
        modelProvider: null,
        model: null,
        skillName: "generate_trade_plan",
        promptVersion: "deterministic-v1",
        status: "success",
        tokenUsageJson: null,
        executionEligible: true,
        tradePlanVersionId: "plan-version-1",
        errorMessage: null,
        startedAt: "2026-05-21T00:00:00.000Z",
        completedAt: "2026-05-21T00:00:01.000Z",
        latencyMs: 1000
      }
    ]);

    const response = await handleListDashboardAgentRunsRequest(
      request("10"),
      repository
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        limit: 10,
        agent_runs: [
          {
            id: "run-1",
            marketKey: "BINANCE:BTCUSDT:240",
            sourceEventKey: "event-1",
            operation: "plan.generate",
            runnerKind: "deterministic",
            modelProvider: null,
            model: null,
            skillName: "generate_trade_plan",
            promptVersion: "deterministic-v1",
            status: "success",
            tokenUsageJson: null,
            executionEligible: true,
            tradePlanVersionId: "plan-version-1",
            errorMessage: null,
            startedAt: "2026-05-21T00:00:00.000Z",
            completedAt: "2026-05-21T00:00:01.000Z",
            latencyMs: 1000
          }
        ]
      }
    });
  });

  it("rejects invalid limit", async () => {
    const response = await handleListDashboardAgentRunsRequest(
      request("0"),
      new InMemoryDashboardReadModelRepository([])
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "invalid_limit"
    });
  });
});
