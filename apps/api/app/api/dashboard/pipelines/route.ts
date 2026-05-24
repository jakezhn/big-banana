import { createDashboardReadModelRepositoryFromEnv } from "@big-banana/db";
import type { DashboardReadModelRepository } from "@big-banana/domain";
import { handleListDashboardPipelinesRequest } from "../../../../src/dashboard/handle-list-dashboard-pipelines-request";

export const dynamic = "force-dynamic";
export const revalidate = 0;

let dashboardReadModelRepository: DashboardReadModelRepository | undefined;

export async function GET(request: Request): Promise<Response> {
  return handleListDashboardPipelinesRequest(
    request,
    getDashboardReadModelRepository()
  );
}

function getDashboardReadModelRepository(): DashboardReadModelRepository {
  dashboardReadModelRepository ??= createDashboardReadModelRepositoryFromEnv();
  return dashboardReadModelRepository;
}
