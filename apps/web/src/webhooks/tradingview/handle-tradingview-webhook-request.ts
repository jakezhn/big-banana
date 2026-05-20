import {
  evaluateAndRecordDeterministicRiskVerdict,
  generateAndRecordTradePlanForSignal,
  InvalidTradingViewPayloadError,
  ingestTradingViewPayload,
  processDeterministicSignalPipeline,
  projectTradingViewMarketState,
  type ExecutionIntentRepository,
  type MarketStateRepository,
  type OrderRepository,
  type RiskPolicySnapshot,
  type RiskVerdictRepository,
  submitPaperOrderFromExecutionIntent,
  type TradePlanVersionRepository,
  type WebhookEventRepository
} from "@big-banana/domain";
import type { PipelineMode } from "../../trading/get-pipeline-mode-from-env";

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
  riskVerdictRepository: RiskVerdictRepository;
  executionIntentRepository: ExecutionIntentRepository;
  orderRepository: OrderRepository;
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
        ? await processSignalPipeline(result.envelope, dependencies)
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
  envelope: Parameters<typeof processDeterministicSignalPipeline>[0],
  dependencies: TradingViewWebhookRequestDependencies
): Promise<string> {
  if (dependencies.pipelineMode === "advisory") {
    return processAdvisorySignalPipeline(envelope, dependencies);
  }

  const result = await processDeterministicSignalPipeline(
    envelope,
    dependencies.riskPolicy,
    {
      marketStateRepository: dependencies.marketStateRepository,
      tradePlanVersionRepository: dependencies.tradePlanVersionRepository,
      riskVerdictRepository: dependencies.riskVerdictRepository,
      executionIntentRepository: dependencies.executionIntentRepository
    }
  );

  if (result.executionIntent) {
    const existingOrder =
      await dependencies.orderRepository.getLatestOrderByExecutionIntentId(
        result.executionIntent.id
      );

    if (!existingOrder) {
      await submitPaperOrderFromExecutionIntent(
        result.executionIntent,
        dependencies.orderRepository
      );
    }

    return "order_submitted";
  }

  if (result.riskVerdict.verdict === "reject") {
    return "risk_rejected";
  }

  return "risk_approved";
}

async function processAdvisorySignalPipeline(
  envelope: Parameters<typeof processDeterministicSignalPipeline>[0],
  dependencies: TradingViewWebhookRequestDependencies
): Promise<string> {
  const plan = await generateAndRecordTradePlanForSignal(
    envelope,
    dependencies.marketStateRepository,
    dependencies.tradePlanVersionRepository
  );
  const riskVerdict = await evaluateAndRecordDeterministicRiskVerdict(
    plan.recordResult.tradePlanVersion,
    dependencies.riskPolicy,
    dependencies.riskVerdictRepository
  );

  if (riskVerdict.verdict === "reject") {
    return "risk_rejected";
  }

  return "risk_approved";
}
