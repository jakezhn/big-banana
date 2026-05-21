import { describe, expect, it } from "vitest";
import type {
  DashboardOverviewReadModel,
  DashboardPipelineListItem,
  DashboardReadModelRepository
} from "@big-banana/domain";
import { handleListDashboardPipelinesRequest } from "../../src/dashboard/handle-list-dashboard-pipelines-request";

class InMemoryDashboardReadModelRepository
  implements DashboardReadModelRepository
{
  constructor(
    private readonly pipelines: DashboardPipelineListItem[],
    private readonly overview: DashboardOverviewReadModel = {
      signalsTodayCount: 0,
      plansTodayCount: 0,
      riskRejectsTodayCount: 0,
      ordersSubmittedTodayCount: 0,
      ordersFilledTodayCount: 0,
      ordersCanceledTodayCount: 0,
      openPositionsCount: 0,
      interventionsTodayCount: 0
    }
  ) {}

  async getOverview(): Promise<DashboardOverviewReadModel> {
    return this.overview;
  }

  async listRecentPipelines(limit: number): Promise<DashboardPipelineListItem[]> {
    return this.pipelines.slice(0, limit);
  }
}

function request(limit?: string): Request {
  const suffix = limit ? `?limit=${encodeURIComponent(limit)}` : "";
  return new Request(`http://localhost/api/dashboard/pipelines${suffix}`);
}

describe("GET /api/dashboard/pipelines", () => {
  it("returns recent pipelines using the provided limit", async () => {
    const repository = new InMemoryDashboardReadModelRepository([
      {
        marketKey: "BINANCE:BTCUSDT:240",
        tickerid: "BINANCE:BTCUSDT",
        timeframe: "240",
        updatedAt: "2026-05-21T00:00:00.000Z",
        pipelineStatus: "order_submitted",
        tradePlanAction: "create",
        riskVerdict: "approve",
        latestOrderStatus: "acked"
      }
    ]);

    const response = await handleListDashboardPipelinesRequest(
      request("10"),
      repository
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        limit: 10,
        pipelines: [
          {
            marketKey: "BINANCE:BTCUSDT:240",
            tickerid: "BINANCE:BTCUSDT",
            timeframe: "240",
            updatedAt: "2026-05-21T00:00:00.000Z",
            pipelineStatus: "order_submitted",
            tradePlanAction: "create",
            riskVerdict: "approve",
            latestOrderStatus: "acked"
          }
        ]
      }
    });
  });

  it("uses a default limit of 20", async () => {
    const response = await handleListDashboardPipelinesRequest(
      request(),
      new InMemoryDashboardReadModelRepository([])
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        limit: 20,
        pipelines: []
      }
    });
  });

  it("rejects invalid limit", async () => {
    const response = await handleListDashboardPipelinesRequest(
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
