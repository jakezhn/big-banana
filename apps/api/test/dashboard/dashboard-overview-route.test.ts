import { describe, expect, it } from "vitest";
import type {
  DashboardOverviewReadModel,
  DashboardReadModelRepository
} from "@big-banana/domain";
import { handleGetDashboardOverviewRequest } from "../../src/dashboard/handle-get-dashboard-overview-request";

class InMemoryDashboardReadModelRepository
  implements DashboardReadModelRepository
{
  constructor(
    private readonly overview: DashboardOverviewReadModel,
    private readonly pipelines = []
  ) {}

  async getOverview(): Promise<DashboardOverviewReadModel> {
    return this.overview;
  }

  async listRecentPipelines(): Promise<[]> {
    return this.pipelines as [];
  }
}

describe("GET /api/dashboard/overview", () => {
  it("returns dashboard overview metrics", async () => {
    const response = await handleGetDashboardOverviewRequest(
      new InMemoryDashboardReadModelRepository({
        signalsTodayCount: 12,
        plansTodayCount: 8,
        riskRejectsTodayCount: 2,
        ordersSubmittedTodayCount: 6,
        ordersFilledTodayCount: 4,
        ordersCanceledTodayCount: 1,
        openPositionsCount: 2,
        interventionsTodayCount: 1
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        overview: {
          signalsTodayCount: 12,
          plansTodayCount: 8,
          riskRejectsTodayCount: 2,
          ordersSubmittedTodayCount: 6,
          ordersFilledTodayCount: 4,
          ordersCanceledTodayCount: 1,
          openPositionsCount: 2,
          interventionsTodayCount: 1
        }
      }
    });
  });
});
