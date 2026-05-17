import {
  submitPaperOrderFromExecutionIntent,
  type MarketPipelineReadModelRepository,
  type OrderRepository
} from "@big-banana/domain";

type ErrorResponse = {
  ok: false;
  error:
    | "missing_market_key"
    | "not_found"
    | "intent_not_ready"
    | "already_submitted";
};

type SuccessResponse = {
  ok: true;
  status: "submitted" | "already_submitted";
  order_id: string;
};

function jsonResponse(
  body: ErrorResponse | SuccessResponse,
  status: number
): Response {
  return Response.json(body, { status });
}

export async function handleSubmitMarketPipelineRequest(
  request: Request,
  readModelRepository: MarketPipelineReadModelRepository,
  orderRepository: OrderRepository
): Promise<Response> {
  const marketKey = new URL(request.url).searchParams.get("market_key");

  if (!marketKey) {
    return jsonResponse({ ok: false, error: "missing_market_key" }, 400);
  }

  const snapshot = await readModelRepository.getLatestMarketPipeline(marketKey);

  if (!snapshot) {
    return jsonResponse({ ok: false, error: "not_found" }, 404);
  }

  if (!snapshot.executionIntent) {
    return jsonResponse({ ok: false, error: "intent_not_ready" }, 409);
  }

  const existingOrder = await orderRepository.getLatestOrderByExecutionIntentId(
    snapshot.executionIntent.id
  );

  if (existingOrder) {
    return jsonResponse(
      {
        ok: true,
        status: "already_submitted",
        order_id: existingOrder.id
      },
      200
    );
  }

  const order = await submitPaperOrderFromExecutionIntent(
    snapshot.executionIntent,
    orderRepository
  );

  return jsonResponse(
    {
      ok: true,
      status: "submitted",
      order_id: order.id
    },
    200
  );
}
