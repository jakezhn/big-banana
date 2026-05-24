import {
  createAgentJobRepositoryFromEnv,
  createAgentRunRepositoryFromEnv,
  createExecutionIntentRepositoryFromEnv,
  createMarketStateRepositoryFromEnv,
  createOrderRepositoryFromEnv,
  createPositionRepositoryFromEnv,
  createRiskVerdictRepositoryFromEnv,
  createTradePlanVersionRepositoryFromEnv,
  createWebhookEventRepositoryFromEnv
} from "@big-banana/db";
import type {
  AgentRunRepository,
  AgentJobRepository,
  ExecutionIntentRepository,
  MarketStateRepository,
  OrderRepository,
  PositionRepository,
  RiskVerdictRepository,
  RiskPolicySnapshot,
  TradePlanVersionRepository,
  WebhookEventRepository
} from "@big-banana/domain";
import { getDeterministicRiskPolicyFromEnv } from "../../../../src/trading/get-deterministic-risk-policy-from-env";
import {
  getPipelineModeFromEnv,
  type PipelineMode
} from "../../../../src/trading/get-pipeline-mode-from-env";
import { handleTradingViewWebhookRequest } from "../../../../src/webhooks/tradingview/handle-tradingview-webhook-request";

let webhookEventRepository: WebhookEventRepository | undefined;
let marketStateRepository: MarketStateRepository | undefined;
let tradePlanVersionRepository: TradePlanVersionRepository | undefined;
let agentRunRepository: AgentRunRepository | undefined;
let agentJobRepository: AgentJobRepository | undefined;
let riskVerdictRepository: RiskVerdictRepository | undefined;
let executionIntentRepository: ExecutionIntentRepository | undefined;
let orderRepository: OrderRepository | undefined;
let positionRepository: PositionRepository | undefined;
let riskPolicy: RiskPolicySnapshot | undefined;
let pipelineMode: PipelineMode | undefined;

export async function POST(request: Request): Promise<Response> {
  return handleTradingViewWebhookRequest(request, {
    webhookEventRepository: getWebhookEventRepository(),
    marketStateRepository: getMarketStateRepository(),
    tradePlanVersionRepository: getTradePlanVersionRepository(),
    agentRunRepository: getAgentRunRepository(),
    agentJobRepository: getAgentJobRepository(),
    riskVerdictRepository: getRiskVerdictRepository(),
    executionIntentRepository: getExecutionIntentRepository(),
    orderRepository: getOrderRepository(),
    positionRepository: getPositionRepository(),
    riskPolicy: getRiskPolicy(),
    pipelineMode: getPipelineMode()
  });
}

function getWebhookEventRepository(): WebhookEventRepository {
  webhookEventRepository ??= createWebhookEventRepositoryFromEnv();
  return webhookEventRepository;
}

function getMarketStateRepository(): MarketStateRepository {
  marketStateRepository ??= createMarketStateRepositoryFromEnv();
  return marketStateRepository;
}

function getTradePlanVersionRepository(): TradePlanVersionRepository {
  tradePlanVersionRepository ??= createTradePlanVersionRepositoryFromEnv();
  return tradePlanVersionRepository;
}

function getAgentRunRepository(): AgentRunRepository {
  agentRunRepository ??= createAgentRunRepositoryFromEnv();
  return agentRunRepository;
}

function getAgentJobRepository(): AgentJobRepository {
  agentJobRepository ??= createAgentJobRepositoryFromEnv();
  return agentJobRepository;
}

function getRiskVerdictRepository(): RiskVerdictRepository {
  riskVerdictRepository ??= createRiskVerdictRepositoryFromEnv();
  return riskVerdictRepository;
}

function getExecutionIntentRepository(): ExecutionIntentRepository {
  executionIntentRepository ??= createExecutionIntentRepositoryFromEnv();
  return executionIntentRepository;
}

function getOrderRepository(): OrderRepository {
  orderRepository ??= createOrderRepositoryFromEnv();
  return orderRepository;
}

function getPositionRepository(): PositionRepository {
  positionRepository ??= createPositionRepositoryFromEnv();
  return positionRepository;
}

function getRiskPolicy(): RiskPolicySnapshot {
  riskPolicy ??= getDeterministicRiskPolicyFromEnv();
  return riskPolicy;
}

function getPipelineMode(): PipelineMode {
  pipelineMode ??= getPipelineModeFromEnv();
  return pipelineMode;
}
