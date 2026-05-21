import type {
  DashboardAgentRunListItem,
  DashboardReadModelRepository
} from "@big-banana/domain";

type ErrorResponse = {
  ok: false;
  error: "invalid_limit";
};

type SuccessResponse = {
  ok: true;
  data: {
    agent_runs: DashboardAgentRunListItem[];
    limit: number;
  };
};

function jsonResponse(
  body: ErrorResponse | SuccessResponse,
  status: number
): Response {
  return Response.json(body, { status });
}

export async function handleListDashboardAgentRunsRequest(
  request: Request,
  repository: DashboardReadModelRepository
): Promise<Response> {
  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = limitParam === null ? 20 : Number(limitParam);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
    return jsonResponse({ ok: false, error: "invalid_limit" }, 400);
  }

  const agentRuns = await repository.listRecentAgentRuns(limit);

  return jsonResponse(
    {
      ok: true,
      data: {
        agent_runs: agentRuns,
        limit
      }
    },
    200
  );
}
