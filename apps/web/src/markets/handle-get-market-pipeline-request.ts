import type {
  MarketPipelineReadModel,
  MarketPipelineReadModelRepository
} from "@big-banana/domain";

type ErrorResponse = {
  ok: false;
  error: "missing_market_key" | "not_found";
};

type SuccessResponse = {
  ok: true;
  data: {
    market_key: string;
    market_state: MarketPipelineReadModel["marketState"];
    trade_plan_version: MarketPipelineReadModel["tradePlanVersion"];
    risk_verdict: MarketPipelineReadModel["riskVerdict"];
    execution_intent: MarketPipelineReadModel["executionIntent"];
    latest_order: MarketPipelineReadModel["latestOrder"];
  };
};

function jsonResponse(
  body: ErrorResponse | SuccessResponse,
  status: number
): Response {
  return Response.json(body, { status });
}

export async function handleGetMarketPipelineRequest(
  request: Request,
  repository: MarketPipelineReadModelRepository
): Promise<Response> {
  const marketKey = new URL(request.url).searchParams.get("market_key");

  if (!marketKey) {
    return jsonResponse({ ok: false, error: "missing_market_key" }, 400);
  }

  const snapshot = await repository.getLatestMarketPipeline(marketKey);

  if (!snapshot) {
    return jsonResponse({ ok: false, error: "not_found" }, 404);
  }

  return jsonResponse(
    {
      ok: true,
      data: {
        market_key: snapshot.marketKey,
        market_state: snapshot.marketState,
        trade_plan_version: snapshot.tradePlanVersion,
        risk_verdict: snapshot.riskVerdict,
        execution_intent: snapshot.executionIntent,
        latest_order: snapshot.latestOrder
      }
    },
    200
  );
}
