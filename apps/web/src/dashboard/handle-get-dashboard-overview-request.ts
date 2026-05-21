import type {
  DashboardOverviewReadModel,
  DashboardReadModelRepository
} from "@big-banana/domain";

type SuccessResponse = {
  ok: true;
  data: {
    overview: DashboardOverviewReadModel;
  };
};

function jsonResponse(body: SuccessResponse, status: number): Response {
  return Response.json(body, { status });
}

export async function handleGetDashboardOverviewRequest(
  repository: DashboardReadModelRepository
): Promise<Response> {
  const overview = await repository.getOverview();

  return jsonResponse(
    {
      ok: true,
      data: {
        overview
      }
    },
    200
  );
}
