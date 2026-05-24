import {
  createTradePlanGeneratorFromEnv,
  parseGeneratePlanJobPayload
} from "@big-banana/agent";
import type {
  AgentRunRepository,
  ExecutionIntentRepository,
  JsonValue,
  MarketStateRepository,
  OrderRepository,
  PositionRepository,
  RiskVerdictRepository,
  TradePlanVersionRepository,
  WebhookEventRepository
} from "@big-banana/domain";
import {
  evaluateAndRecordDeterministicRiskVerdict,
  generateAndRecordTradePlanWithGenerator,
  processSignalPipelineWithGenerator,
  submitPaperOrderFromExecutionIntent
} from "@big-banana/domain";
import type { AgentJobHandler } from "../agent-job-handler";

export type GeneratePlanHandlerDependencies = {
  webhookEventRepository: WebhookEventRepository;
  marketStateRepository: MarketStateRepository;
  tradePlanVersionRepository: TradePlanVersionRepository;
  agentRunRepository: AgentRunRepository;
  riskVerdictRepository: RiskVerdictRepository;
  executionIntentRepository: ExecutionIntentRepository;
  orderRepository: OrderRepository;
  positionRepository: PositionRepository;
};

export function createGeneratePlanHandler(
  dependencies: GeneratePlanHandlerDependencies,
  env: NodeJS.ProcessEnv = process.env
): AgentJobHandler {
  const configuredGenerator = createTradePlanGeneratorFromEnv(env);

  return async (job) => {
    const payload = parseGeneratePlanJobPayload(job.payloadJson);

    try {
      const processStatus =
        payload.pipelineMode === "advisory"
          ? await processAdvisorySignalPipeline(payload, dependencies, configuredGenerator)
          : await processFullSignalPipeline(payload, dependencies, configuredGenerator);

      await dependencies.webhookEventRepository.updateProcessStatus(
        payload.webhookEventId,
        processStatus
      );

      return {
        jobType: job.jobType,
        market: job.market,
        symbol: job.symbol,
        timeframe: job.timeframe,
        webhookEventId: payload.webhookEventId,
        eventKey: payload.envelope.eventKey,
        processStatus,
        pipelineMode: payload.pipelineMode
      } satisfies Record<string, JsonValue>;
    } catch (error) {
      await dependencies.webhookEventRepository.updateProcessStatus(
        payload.webhookEventId,
        "failed"
      );

      throw error;
    }
  };
}

async function processFullSignalPipeline(
  payload: ReturnType<typeof parseGeneratePlanJobPayload>,
  dependencies: GeneratePlanHandlerDependencies,
  configuredGenerator: ReturnType<typeof createTradePlanGeneratorFromEnv>
): Promise<string> {
  const result = await processSignalPipelineWithGenerator(
    payload.envelope,
    payload.riskPolicy,
    {
      marketStateRepository: dependencies.marketStateRepository,
      tradePlanVersionRepository: dependencies.tradePlanVersionRepository,
      orderRepository: dependencies.orderRepository,
      positionRepository: dependencies.positionRepository,
      tradingAccountId: payload.riskPolicy.tradingAccountId,
      agentRunRepository: dependencies.agentRunRepository,
      riskVerdictRepository: dependencies.riskVerdictRepository,
      executionIntentRepository: dependencies.executionIntentRepository
    },
    configuredGenerator.generator,
    configuredGenerator.runner
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
  payload: ReturnType<typeof parseGeneratePlanJobPayload>,
  dependencies: GeneratePlanHandlerDependencies,
  configuredGenerator: ReturnType<typeof createTradePlanGeneratorFromEnv>
): Promise<string> {
  const plan = await generateAndRecordTradePlanWithGenerator(
    payload.envelope,
    {
      marketStateRepository: dependencies.marketStateRepository,
      tradePlanVersionRepository: dependencies.tradePlanVersionRepository,
      orderRepository: dependencies.orderRepository,
      positionRepository: dependencies.positionRepository,
      tradingAccountId: payload.riskPolicy.tradingAccountId
    },
    dependencies.tradePlanVersionRepository,
    dependencies.agentRunRepository,
    configuredGenerator.generator,
    configuredGenerator.runner
  );

  if (!plan.recordResult) {
    throw new Error("Advisory pipeline expected a persisted trade plan version");
  }

  const riskVerdict = await evaluateAndRecordDeterministicRiskVerdict(
    plan.recordResult.tradePlanVersion,
    payload.riskPolicy,
    dependencies.riskVerdictRepository
  );

  if (riskVerdict.verdict === "reject") {
    return "risk_rejected";
  }

  return "risk_approved";
}
