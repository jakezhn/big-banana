import {
  createAgentRunRepositoryFromEnv,
  createExecutionIntentRepositoryFromEnv,
  createMarketStateRepositoryFromEnv,
  createOrderRepositoryFromEnv,
  createRiskVerdictRepositoryFromEnv,
  createTradePlanVersionRepositoryFromEnv,
  createWebhookEventRepositoryFromEnv
} from "@big-banana/db";
import type {
  AgentRunRepository,
  ExecutionIntentRepository,
  MarketStateRepository,
  OrderRepository,
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
let riskVerdictRepository: RiskVerdictRepository | undefined;
let executionIntentRepository: ExecutionIntentRepository | undefined;
let orderRepository: OrderRepository | undefined;
let riskPolicy: RiskPolicySnapshot | undefined;
let pipelineMode: PipelineMode | undefined;

export async function POST(request: Request): Promise<Response> {
  return handleTradingViewWebhookRequest(request, {
    webhookEventRepository: getWebhookEventRepository(),
    marketStateRepository: getMarketStateRepository(),
    tradePlanVersionRepository: getTradePlanVersionRepository(),
    agentRunRepository: getAgentRunRepository(),
    riskVerdictRepository: getRiskVerdictRepository(),
    executionIntentRepository: getExecutionIntentRepository(),
    orderRepository: getOrderRepository(),
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

function getRiskPolicy(): RiskPolicySnapshot {
  riskPolicy ??= getDeterministicRiskPolicyFromEnv();
  return riskPolicy;
}

function getPipelineMode(): PipelineMode {
  pipelineMode ??= getPipelineModeFromEnv();
  return pipelineMode;
}
