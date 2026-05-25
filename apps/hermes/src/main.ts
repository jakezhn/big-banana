import {
  createAgentJobRepositoryFromEnv,
  createAgentRunRepositoryFromEnv,
  createExecutionIntentRepositoryFromEnv,
  createMarketStateRepositoryFromEnv,
  createOrderRepositoryFromEnv,
  createPlanRevisionSuggestionRepositoryFromEnv,
  createPositionRepositoryFromEnv,
  createRiskVerdictRepositoryFromEnv,
  createTradePlanVersionRepositoryFromEnv,
  createWebhookEventRepositoryFromEnv
} from "@big-banana/db";
import { getHermesWorkerConfigFromEnv } from "./config/get-hermes-worker-config-from-env";
import { createDefaultAgentJobHandlers } from "./worker/create-default-agent-job-handlers";
import { AgentJobWorker } from "./worker/agent-job-worker";

async function main(): Promise<void> {
  const config = getHermesWorkerConfigFromEnv();
  const worker = new AgentJobWorker({
    jobRepository: createAgentJobRepositoryFromEnv(),
    config,
    handlers: createDefaultAgentJobHandlers({
      webhookEventRepository: createWebhookEventRepositoryFromEnv(),
      marketStateRepository: createMarketStateRepositoryFromEnv(),
      tradePlanVersionRepository: createTradePlanVersionRepositoryFromEnv(),
      orderRepository: createOrderRepositoryFromEnv(),
      positionRepository: createPositionRepositoryFromEnv(),
      planRevisionSuggestionRepository:
        createPlanRevisionSuggestionRepositoryFromEnv(),
      agentRunRepository: createAgentRunRepositoryFromEnv(),
      riskVerdictRepository: createRiskVerdictRepositoryFromEnv(),
      executionIntentRepository: createExecutionIntentRepositoryFromEnv(),
      tradingAccountId: config.tradingAccountId
    })
  });

  const controller = new AbortController();
  const stop = () => controller.abort();

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);

  await worker.runUntilStopped(controller.signal);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
