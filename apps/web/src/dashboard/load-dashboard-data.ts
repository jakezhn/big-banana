import type {
  DashboardOverviewReadModel,
  DashboardPipelineListItem,
  MarketPipelineReadModel
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

export async function loadMarketPipeline(
  marketKey: string
): Promise<
  MarketPipelineReadModel & {
    pipelineStatus: string;
  }
> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/market-pipeline?market_key=${encodeURIComponent(marketKey)}`,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to load market pipeline: ${response.status}`);
  }

  const body = (await response.json()) as {
    ok: true;
    data: {
      market_key: string;
      pipeline_status: string;
      market_state: MarketPipelineReadModel["marketState"];
      trade_plan_version: MarketPipelineReadModel["tradePlanVersion"];
      risk_verdict: MarketPipelineReadModel["riskVerdict"];
      execution_intent: MarketPipelineReadModel["executionIntent"];
      latest_order: MarketPipelineReadModel["latestOrder"];
      latest_fill: MarketPipelineReadModel["latestFill"];
      current_position: MarketPipelineReadModel["currentPosition"];
    };
  };

  return {
    marketKey: body.data.market_key,
    pipelineStatus: body.data.pipeline_status,
    marketState: body.data.market_state,
    tradePlanVersion: body.data.trade_plan_version,
    riskVerdict: body.data.risk_verdict,
    executionIntent: body.data.execution_intent,
    latestOrder: body.data.latest_order,
    latestFill: body.data.latest_fill,
    currentPosition: body.data.current_position
  };
}
