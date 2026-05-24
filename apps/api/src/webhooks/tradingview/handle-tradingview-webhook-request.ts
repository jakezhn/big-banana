import {
  InvalidTradingViewPayloadError,
  ingestTradingViewPayload,
  projectTradingViewMarketState,
  type CanonicalEnvelope,
  type AgentRunRepository,
  type AgentJobRepository,
  type ExecutionIntentRepository,
  type MarketStateRepository,
  type OrderRepository,
  type PositionRepository,
  type RiskVerdictRepository,
  type TradePlanVersionRepository,
  type WebhookEventRepository
} from "@big-banana/domain";
import type { PipelineMode } from "../../trading/get-pipeline-mode-from-env";
import { buildGeneratePlanJobInput } from "@big-banana/agent";
import type { RiskPolicySnapshot } from "@big-banana/domain";

type ErrorResponse = {
  accepted: false;
  error: "invalid_content_type" | "invalid_json" | "invalid_payload";
};

type SuccessResponse = {
  accepted: true;
  event_key: string;
  duplicate: boolean;
  process_status: string;
};

export type TradingViewWebhookRequestDependencies = {
  webhookEventRepository: WebhookEventRepository;
  marketStateRepository: MarketStateRepository;
  tradePlanVersionRepository: TradePlanVersionRepository;
  agentRunRepository: AgentRunRepository;
  agentJobRepository: AgentJobRepository;
  riskVerdictRepository: RiskVerdictRepository;
  executionIntentRepository: ExecutionIntentRepository;
  orderRepository: OrderRepository;
  positionRepository: PositionRepository;
  riskPolicy: RiskPolicySnapshot;
  pipelineMode: PipelineMode;
};

function jsonResponse(
  body: ErrorResponse | SuccessResponse,
  status: number
): Response {
  return Response.json(body, { status });
}

export async function handleTradingViewWebhookRequest(
  request: Request,
  dependencies: TradingViewWebhookRequestDependencies
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
    const result = await ingestTradingViewPayload(
      payload,
      dependencies.webhookEventRepository
    );

    if (shouldSkipProcessedDuplicate(result.webhookEvent)) {
      return jsonResponse(
        {
          accepted: true,
          event_key: result.envelope.eventKey,
          duplicate: true,
          process_status: result.webhookEvent.processStatus
        },
        200
      );
    }

    await projectTradingViewMarketState(
      result,
      dependencies.marketStateRepository
    );

    const processStatus =
      result.envelope.type === "signal"
        ? await processSignalPipeline(
            result.envelope,
            result.webhookEvent.id,
            dependencies
          )
        : "normalized";

    await dependencies.webhookEventRepository.updateProcessStatus(
      result.webhookEvent.id,
      processStatus
    );

    return jsonResponse(
      {
        accepted: true,
        event_key: result.envelope.eventKey,
        duplicate: result.webhookEvent.duplicate,
        process_status: processStatus
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

function shouldSkipProcessedDuplicate(
  webhookEvent: Awaited<ReturnType<WebhookEventRepository["recordReceivedEvent"]>>
): boolean {
  return webhookEvent.duplicate && webhookEvent.processStatus !== "received";
}

async function processSignalPipeline(
  envelope: CanonicalEnvelope,
  webhookEventId: string,
  dependencies: TradingViewWebhookRequestDependencies
): Promise<string> {
  await dependencies.agentJobRepository.enqueueJob(
    buildGeneratePlanJobInput(
      {
        webhookEventId,
        envelope,
        riskPolicy: dependencies.riskPolicy,
        pipelineMode: dependencies.pipelineMode
      },
      {
        createdAt: new Date().toISOString()
      }
    )
  );

  return "queued";
}
