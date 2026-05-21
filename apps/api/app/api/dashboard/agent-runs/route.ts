import { createDashboardReadModelRepositoryFromEnv } from "@big-banana/db";
import type { DashboardReadModelRepository } from "@big-banana/domain";
import { handleListDashboardAgentRunsRequest } from "../../../../src/dashboard/handle-list-dashboard-agent-runs-request";

let dashboardReadModelRepository: DashboardReadModelRepository | undefined;

export async function GET(request: Request): Promise<Response> {
  return handleListDashboardAgentRunsRequest(
    request,
    getDashboardReadModelRepository()
  );
}

function getDashboardReadModelRepository(): DashboardReadModelRepository {
  dashboardReadModelRepository ??= createDashboardReadModelRepositoryFromEnv();
  return dashboardReadModelRepository;
}
