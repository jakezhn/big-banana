import type {
  DashboardOverviewReadModel,
  DashboardPipelineListItem,
  DashboardAgentRunListItem,
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

  if (response.status === 404) {
    return Promise.reject(new MarketPipelineNotFoundError(marketKey));
  }

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
      latest_plan_revision_suggestion: MarketPipelineReadModel["latestPlanRevisionSuggestion"];
      latest_post_plan_review: MarketPipelineReadModel["latestPostPlanReview"];
      memory_lesson_candidates: MarketPipelineReadModel["memoryLessonCandidates"];
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
    latestPlanRevisionSuggestion: body.data.latest_plan_revision_suggestion,
    latestPostPlanReview: body.data.latest_post_plan_review,
    memoryLessonCandidates: body.data.memory_lesson_candidates,
    riskVerdict: body.data.risk_verdict,
    executionIntent: body.data.execution_intent,
    latestOrder: body.data.latest_order,
    latestFill: body.data.latest_fill,
    currentPosition: body.data.current_position
  };
}

export class MarketPipelineNotFoundError extends Error {
  constructor(readonly marketKey: string) {
    super(`Market pipeline not found: ${marketKey}`);
    this.name = "MarketPipelineNotFoundError";
  }
}

export async function loadDashboardAgentRuns(
  limit: number
): Promise<DashboardAgentRunListItem[]> {
  const response = await fetch(
    `${getApiBaseUrl()}/api/dashboard/agent-runs?limit=${encodeURIComponent(String(limit))}`,
    {
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to load dashboard agent runs: ${response.status}`);
  }

  const body = (await response.json()) as {
    ok: true;
    data: { agent_runs: DashboardAgentRunListItem[] };
  };

  return body.data.agent_runs;
}
