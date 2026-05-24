import { createDashboardReadModelRepositoryFromEnv } from "@big-banana/db";
import type { DashboardReadModelRepository } from "@big-banana/domain";
import { handleGetDashboardOverviewRequest } from "../../../../src/dashboard/handle-get-dashboard-overview-request";

export const dynamic = "force-dynamic";
export const revalidate = 0;

let dashboardReadModelRepository: DashboardReadModelRepository | undefined;

export async function GET(): Promise<Response> {
  return handleGetDashboardOverviewRequest(getDashboardReadModelRepository());
}

function getDashboardReadModelRepository(): DashboardReadModelRepository {
  dashboardReadModelRepository ??= createDashboardReadModelRepositoryFromEnv();
  return dashboardReadModelRepository;
}
