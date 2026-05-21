import { createDashboardReadModelRepositoryFromEnv } from "@big-banana/db";
import type {
  DashboardOverviewReadModel,
  DashboardPipelineListItem,
  DashboardReadModelRepository
} from "@big-banana/domain";

let dashboardReadModelRepository: DashboardReadModelRepository | undefined;

export async function loadDashboardOverview(): Promise<DashboardOverviewReadModel> {
  return getDashboardReadModelRepository().getOverview();
}

export async function loadDashboardPipelines(
  limit: number
): Promise<DashboardPipelineListItem[]> {
  return getDashboardReadModelRepository().listRecentPipelines(limit);
}

function getDashboardReadModelRepository(): DashboardReadModelRepository {
  dashboardReadModelRepository ??= createDashboardReadModelRepositoryFromEnv();
  return dashboardReadModelRepository;
}
