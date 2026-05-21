import type {
  DashboardPipelineListItem,
  DashboardReadModelRepository
} from "@big-banana/domain";

type ErrorResponse = {
  ok: false;
  error: "invalid_limit";
};

type SuccessResponse = {
  ok: true;
  data: {
    pipelines: DashboardPipelineListItem[];
    limit: number;
  };
};

function jsonResponse(
  body: ErrorResponse | SuccessResponse,
  status: number
): Response {
  return Response.json(body, { status });
}

export async function handleListDashboardPipelinesRequest(
  request: Request,
  repository: DashboardReadModelRepository
): Promise<Response> {
  const limitParam = new URL(request.url).searchParams.get("limit");
  const limit = limitParam === null ? 20 : Number(limitParam);

  if (!Number.isInteger(limit) || limit <= 0 || limit > 100) {
    return jsonResponse({ ok: false, error: "invalid_limit" }, 400);
  }

  const pipelines = await repository.listRecentPipelines(limit);

  return jsonResponse(
    {
      ok: true,
      data: {
        pipelines,
        limit
      }
    },
    200
  );
}
