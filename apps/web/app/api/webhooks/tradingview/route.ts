import { createWebhookEventRepositoryFromEnv } from "@big-banana/db";
import type { WebhookEventRepository } from "@big-banana/domain";
import { handleTradingViewWebhookRequest } from "../../../../src/webhooks/tradingview/handle-tradingview-webhook-request.js";

let repository: WebhookEventRepository | undefined;

export async function POST(request: Request): Promise<Response> {
  return handleTradingViewWebhookRequest(
    request,
    getWebhookEventRepository()
  );
}

function getWebhookEventRepository(): WebhookEventRepository {
  repository ??= createWebhookEventRepositoryFromEnv();
  return repository;
}
