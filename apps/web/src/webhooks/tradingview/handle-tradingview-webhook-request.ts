import {
  InvalidTradingViewPayloadError,
  ingestTradingViewPayload,
  projectTradingViewMarketState,
  type MarketStateRepository,
  type WebhookEventRepository
} from "@big-banana/domain";

type ErrorResponse = {
  accepted: false;
  error: "invalid_content_type" | "invalid_json" | "invalid_payload";
};

type SuccessResponse = {
  accepted: true;
  event_key: string;
  duplicate: boolean;
};

function jsonResponse(
  body: ErrorResponse | SuccessResponse,
  status: number
): Response {
  return Response.json(body, { status });
}

export async function handleTradingViewWebhookRequest(
  request: Request,
  webhookEventRepository: WebhookEventRepository,
  marketStateRepository: MarketStateRepository
): Promise<Response> {
  const contentType = request.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return jsonResponse(
      { accepted: false, error: "invalid_content_type" },
      415
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ accepted: false, error: "invalid_json" }, 400);
  }

  try {
    const result = await ingestTradingViewPayload(payload, webhookEventRepository);
    await projectTradingViewMarketState(result, marketStateRepository);
    await webhookEventRepository.updateProcessStatus(
      result.webhookEvent.id,
      "normalized"
    );

    return jsonResponse(
      {
        accepted: true,
        event_key: result.envelope.eventKey,
        duplicate: result.webhookEvent.duplicate
      },
      200
    );
  } catch (error) {
    if (error instanceof InvalidTradingViewPayloadError) {
      return jsonResponse({ accepted: false, error: "invalid_payload" }, 400);
    }

    throw error;
  }
}
