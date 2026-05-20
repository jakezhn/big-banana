import {
  buildAndRecordOperatorExecutionIntent,
  reconcilePaperOrder,
  submitPaperOrderFromExecutionIntent,
  type ExecutionIntentRepository,
  type MarketPipelineReadModelRepository,
  type OrderRepository,
  type StoredOrder
} from "@big-banana/domain";
import type { MarketPipelineStatus } from "../markets/derive-market-pipeline-status";

type InterventionAction = "cancel_pending_entry" | "flatten_position";

type ErrorResponse = {
  ok: false;
  error:
    | "missing_market_key"
    | "invalid_body"
    | "unsupported_action"
    | "not_found"
    | "trade_plan_missing"
    | "risk_not_ready"
    | "order_not_available"
    | "pending_entry_not_cancelable"
    | "position_not_flattenable"
    | "already_intervening";
};

type SuccessResponse = {
  ok: true;
  action: InterventionAction;
  pipeline_status: MarketPipelineStatus;
  execution_intent_id?: string;
  order_id: string;
  order_state: string;
};

type RequestBody = {
  action?: unknown;
};

function jsonResponse(
  body: ErrorResponse | SuccessResponse,
  status: number
): Response {
  return Response.json(body, { status });
}

export async function handleInterveneMarketPipelineRequest(
  request: Request,
  readModelRepository: MarketPipelineReadModelRepository,
  executionIntentRepository: ExecutionIntentRepository,
  orderRepository: OrderRepository
): Promise<Response> {
  const marketKey = new URL(request.url).searchParams.get("market_key");

  if (!marketKey) {
    return jsonResponse({ ok: false, error: "missing_market_key" }, 400);
  }

  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_body" }, 400);
  }

  if (
    body.action !== "cancel_pending_entry" &&
    body.action !== "flatten_position"
  ) {
    return jsonResponse({ ok: false, error: "unsupported_action" }, 400);
  }

  const snapshot = await readModelRepository.getLatestMarketPipeline(marketKey);

  if (!snapshot) {
    return jsonResponse({ ok: false, error: "not_found" }, 404);
  }

  if (!snapshot.latestOrder) {
    return jsonResponse({ ok: false, error: "order_not_available" }, 409);
  }

  if (body.action === "cancel_pending_entry") {
    return handleCancelPendingEntry(snapshot.latestOrder, orderRepository);
  }

  if (!snapshot.tradePlanVersion) {
    return jsonResponse({ ok: false, error: "trade_plan_missing" }, 409);
  }

  if (!snapshot.riskVerdict) {
    return jsonResponse({ ok: false, error: "risk_not_ready" }, 409);
  }

  if (snapshot.latestOrder.status !== "filled") {
    return jsonResponse({ ok: false, error: "position_not_flattenable" }, 409);
  }

  if (
    snapshot.executionIntent &&
    snapshot.executionIntent.payload.action === "close" &&
    !isTerminalOrderState(snapshot.latestOrder.status)
  ) {
    return jsonResponse({ ok: false, error: "already_intervening" }, 409);
  }

  const executionIntent = await buildAndRecordOperatorExecutionIntent(
    "close",
    snapshot.tradePlanVersion,
    snapshot.riskVerdict,
    snapshot.latestOrder,
    executionIntentRepository
  );
  const order = await submitPaperOrderFromExecutionIntent(
    executionIntent,
    orderRepository
  );

  return jsonResponse(
    {
      ok: true,
      action: "flatten_position",
      pipeline_status: "order_submitted",
      execution_intent_id: executionIntent.id,
      order_id: order.id,
      order_state: order.status
    },
    200
  );
}

async function handleCancelPendingEntry(
  order: StoredOrder,
  orderRepository: OrderRepository
): Promise<Response> {
  if (order.status !== "acked" || order.filledQty > 0) {
    return jsonResponse(
      { ok: false, error: "pending_entry_not_cancelable" },
      409
    );
  }

  const canceledOrder = await reconcilePaperOrder(
    order,
    "canceled",
    orderRepository
  );

  return jsonResponse(
    {
      ok: true,
      action: "cancel_pending_entry",
      pipeline_status: "order_terminal",
      order_id: canceledOrder.id,
      order_state: canceledOrder.status
    },
    200
  );
}

function isTerminalOrderState(status: string): boolean {
  return (
    status === "filled" ||
    status === "canceled" ||
    status === "rejected" ||
    status === "reconciled_absent"
  );
}
