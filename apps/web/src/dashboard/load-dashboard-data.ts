import type {
  DashboardOverviewReadModel,
  DashboardPipelineListItem
} from "@big-banana/domain";
import { getApiBaseUrl } from "../api/get-api-base-url";

export async function loadDashboardOverview(): Promise<DashboardOverviewReadModel> {
  const response = await fetch(`${getApiBaseUrl()}/api/dashboard/overview`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Failed to load dashboard overview: ${response.status}`);
  }

  const body = (await response.json()) as {
    ok: true;
    data: { overview: DashboardOverviewReadModel };
  };

  return body.data.overview;
}

export async function loadDashboardPipelines(
  limit: number
): Promise<DashboardPipelineListItem[]> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/dashboard/pipelines?limit=${encodeURIComponent(String(limit))}`,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to load dashboard pipelines: ${response.status}`);
  }

  const body = (await response.json()) as {
    ok: true;
    data: { pipelines: DashboardPipelineListItem[] };
  };

  return body.data.pipelines;
}
