import {
  createExecutionIntentRepositoryFromEnv,
  createMarketStateRepositoryFromEnv,
  createRiskVerdictRepositoryFromEnv,
  createTradePlanVersionRepositoryFromEnv,
  createWebhookEventRepositoryFromEnv
} from "@big-banana/db";
import type {
  ExecutionIntentRepository,
  MarketStateRepository,
  RiskVerdictRepository,
  RiskPolicySnapshot,
  TradePlanVersionRepository,
  WebhookEventRepository
} from "@big-banana/domain";
import { getDeterministicRiskPolicyFromEnv } from "../../../../src/trading/get-deterministic-risk-policy-from-env.js";
import { handleTradingViewWebhookRequest } from "../../../../src/webhooks/tradingview/handle-tradingview-webhook-request.js";

let webhookEventRepository: WebhookEventRepository | undefined;
let marketStateRepository: MarketStateRepository | undefined;
let tradePlanVersionRepository: TradePlanVersionRepository | undefined;
let riskVerdictRepository: RiskVerdictRepository | undefined;
let executionIntentRepository: ExecutionIntentRepository | undefined;
let riskPolicy: RiskPolicySnapshot | undefined;

export async function POST(request: Request): Promise<Response> {
  return handleTradingViewWebhookRequest(request, {
    webhookEventRepository: getWebhookEventRepository(),
    marketStateRepository: getMarketStateRepository(),
    tradePlanVersionRepository: getTradePlanVersionRepository(),
    riskVerdictRepository: getRiskVerdictRepository(),
    executionIntentRepository: getExecutionIntentRepository(),
    riskPolicy: getRiskPolicy()
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

function getRiskVerdictRepository(): RiskVerdictRepository {
  riskVerdictRepository ??= createRiskVerdictRepositoryFromEnv();
  return riskVerdictRepository;
}

function getExecutionIntentRepository(): ExecutionIntentRepository {
  executionIntentRepository ??= createExecutionIntentRepositoryFromEnv();
  return executionIntentRepository;
}

function getRiskPolicy(): RiskPolicySnapshot {
  riskPolicy ??= getDeterministicRiskPolicyFromEnv();
  return riskPolicy;
}
