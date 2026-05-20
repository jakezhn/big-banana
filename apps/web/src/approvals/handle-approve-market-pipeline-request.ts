import {
  type ExecutionIntentRepository,
  type MarketPipelineReadModelRepository
} from "@big-banana/domain";

type ErrorResponse = {
  ok: false;
  error: "approval_removed";
};

type SuccessResponse = {
  ok: false;
  error: "approval_removed";
};

function jsonResponse(
  body: ErrorResponse | SuccessResponse,
  status: number
): Response {
  return Response.json(body, { status });
}

export async function handleApproveMarketPipelineRequest(
  _request: Request,
  _readModelRepository: MarketPipelineReadModelRepository,
  _executionIntentRepository: ExecutionIntentRepository
): Promise<Response> {
  return jsonResponse(
    {
      ok: false,
      error: "approval_removed"
    },
    410
  );
}
