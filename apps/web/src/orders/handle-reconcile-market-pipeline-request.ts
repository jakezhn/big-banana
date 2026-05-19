import {
  reconcilePaperOrder,
  UnsupportedPaperReconcileOutcomeError,
  type MarketPipelineReadModelRepository,
  type OrderRepository
} from "@big-banana/domain";
import type { MarketPipelineStatus } from "../markets/derive-market-pipeline-status.js";

type ErrorResponse = {
  ok: false;
  error:
    | "missing_market_key"
    | "missing_outcome"
    | "not_found"
    | "order_not_ready"
    | "already_terminal"
    | "invalid_outcome";
};

type SuccessResponse = {
  ok: true;
  status: "reconciled";
  pipeline_status: MarketPipelineStatus;
  order_id: string;
  order_state: "filled" | "canceled";
};

function jsonResponse(
  body: ErrorResponse | SuccessResponse,
  status: number
): Response {
  return Response.json(body, { status });
}

export async function handleReconcileMarketPipelineRequest(
  request: Request,
  readModelRepository: MarketPipelineReadModelRepository,
  orderRepository: OrderRepository
): Promise<Response> {
  const url = new URL(request.url);
  const marketKey = url.searchParams.get("market_key");
  const outcome = url.searchParams.get("outcome");

  if (!marketKey) {
    return jsonResponse({ ok: false, error: "missing_market_key" }, 400);
  }

  if (!outcome) {
    return jsonResponse({ ok: false, error: "missing_outcome" }, 400);
  }

  const snapshot = await readModelRepository.getLatestMarketPipeline(marketKey);

  if (!snapshot) {
    return jsonResponse({ ok: false, error: "not_found" }, 404);
  }

  if (!snapshot.latestOrder) {
    return jsonResponse({ ok: false, error: "order_not_ready" }, 409);
  }

  if (
    snapshot.latestOrder.status === "filled" ||
    snapshot.latestOrder.status === "canceled"
  ) {
    return jsonResponse({ ok: false, error: "already_terminal" }, 409);
  }

  try {
    const order = await reconcilePaperOrder(
      snapshot.latestOrder,
      outcome as "filled" | "canceled",
      orderRepository
    );

    return jsonResponse(
      {
        ok: true,
        status: "reconciled",
        pipeline_status: "order_terminal",
        order_id: order.id,
        order_state: order.status as "filled" | "canceled"
      },
      200
    );
  } catch (error) {
    if (error instanceof UnsupportedPaperReconcileOutcomeError) {
      return jsonResponse({ ok: false, error: "invalid_outcome" }, 400);
    }

    throw error;
  }
}
