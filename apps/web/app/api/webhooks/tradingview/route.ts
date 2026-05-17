import {
  createMarketStateRepositoryFromEnv,
  createWebhookEventRepositoryFromEnv
} from "@big-banana/db";
import type {
  MarketStateRepository,
  WebhookEventRepository
} from "@big-banana/domain";
import { handleTradingViewWebhookRequest } from "../../../../src/webhooks/tradingview/handle-tradingview-webhook-request.js";

let webhookEventRepository: WebhookEventRepository | undefined;
let marketStateRepository: MarketStateRepository | undefined;

export async function POST(request: Request): Promise<Response> {
  return handleTradingViewWebhookRequest(
    request,
    getWebhookEventRepository(),
    getMarketStateRepository()
  );
}

function getWebhookEventRepository(): WebhookEventRepository {
  webhookEventRepository ??= createWebhookEventRepositoryFromEnv();
  return webhookEventRepository;
}

function getMarketStateRepository(): MarketStateRepository {
  marketStateRepository ??= createMarketStateRepositoryFromEnv();
  return marketStateRepository;
}
