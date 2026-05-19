import {
  buildAndRecordExecutionIntentFromRiskVerdict,
  type ExecutionIntentRepository,
  type MarketPipelineReadModelRepository
} from "@big-banana/domain";
import type { MarketPipelineStatus } from "../markets/derive-market-pipeline-status.js";

type ErrorResponse = {
  ok: false;
  error:
    | "missing_market_key"
    | "not_found"
    | "trade_plan_missing"
    | "risk_not_ready"
    | "risk_rejected"
    | "approval_not_required";
};

type SuccessResponse = {
  ok: true;
  status: "intent_ready" | "already_ready";
  pipeline_status: MarketPipelineStatus;
  execution_intent_id: string;
};

function jsonResponse(
  body: ErrorResponse | SuccessResponse,
  status: number
): Response {
  return Response.json(body, { status });
}

export async function handleApproveMarketPipelineRequest(
  request: Request,
  readModelRepository: MarketPipelineReadModelRepository,
  executionIntentRepository: ExecutionIntentRepository
): Promise<Response> {
  const marketKey = new URL(request.url).searchParams.get("market_key");

  if (!marketKey) {
    return jsonResponse({ ok: false, error: "missing_market_key" }, 400);
  }

  const snapshot = await readModelRepository.getLatestMarketPipeline(marketKey);

  if (!snapshot) {
    return jsonResponse({ ok: false, error: "not_found" }, 404);
  }

  if (snapshot.executionIntent) {
    return jsonResponse(
      {
        ok: true,
        status: "already_ready",
        pipeline_status: "intent_ready",
        execution_intent_id: snapshot.executionIntent.id
      },
      200
    );
  }

  if (!snapshot.tradePlanVersion) {
    return jsonResponse({ ok: false, error: "trade_plan_missing" }, 409);
  }

  if (!snapshot.riskVerdict) {
    return jsonResponse({ ok: false, error: "risk_not_ready" }, 409);
  }

  if (snapshot.riskVerdict.verdict === "reject") {
    return jsonResponse({ ok: false, error: "risk_rejected" }, 409);
  }

  if (!snapshot.riskVerdict.requireHumanApproval) {
    return jsonResponse({ ok: false, error: "approval_not_required" }, 409);
  }

  const executionIntent = await buildAndRecordExecutionIntentFromRiskVerdict(
    snapshot.tradePlanVersion,
    snapshot.riskVerdict,
    executionIntentRepository
  );

  return jsonResponse(
    {
      ok: true,
      status: "intent_ready",
      pipeline_status: "intent_ready",
      execution_intent_id: executionIntent.id
    },
    200
  );
}
