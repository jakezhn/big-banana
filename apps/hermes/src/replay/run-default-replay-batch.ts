import {
  createAgentJobRepositoryFromEnv,
  createAgentRunRepositoryFromEnv,
  createMarketStateRepositoryFromEnv,
  createOrderRepositoryFromEnv,
  createPositionRepositoryFromEnv,
  createTradePlanVersionRepositoryFromEnv
} from "@big-banana/db";
import { getHermesWorkerConfigFromEnv } from "../config/get-hermes-worker-config-from-env";
import { defaultReplayPlannerFixtures } from "./default-replay-planner-fixtures";
import { runReplayPlannerBatch } from "./replay-planner-batch";
import { createReplayPlannerHandler } from "../worker/replay/replay-planner-handler";
import { AgentJobWorker } from "../worker/agent-job-worker";

async function main(): Promise<void> {
  const config = getHermesWorkerConfigFromEnv();
  const jobRepository = createAgentJobRepositoryFromEnv();
  const worker = new AgentJobWorker({
    jobRepository,
    config: {
      ...config,
      jobTypes: ["replay_planner"]
    },
    handlers: {
      replay_planner: createReplayPlannerHandler({
        marketStateRepository: createMarketStateRepositoryFromEnv(),
        tradePlanVersionRepository: createTradePlanVersionRepositoryFromEnv(),
        orderRepository: createOrderRepositoryFromEnv(),
        positionRepository: createPositionRepositoryFromEnv(),
        agentRunRepository: createAgentRunRepositoryFromEnv(),
        tradingAccountId: config.tradingAccountId
      })
    }
  });

  const result = await runReplayPlannerBatch(
    defaultReplayPlannerFixtures,
    {
      jobRepository,
      worker
    },
    {
      idempotencyPrefix: `replay-batch-${new Date().toISOString()}`,
      maxRuns: defaultReplayPlannerFixtures.length * 4
    }
  );

  console.log(
    JSON.stringify(
      {
        totalFixtures: result.totalFixtures,
        completedJobs: result.completedJobs.length,
        failedJobs: result.failedJobs.length,
        cancelledJobs: result.cancelledJobs.length,
        pendingJobs: result.pendingJobs.length,
        summary: result.summary,
        qualityReport: result.qualityReport
      },
      null,
      2
    )
  );

  if (result.failedJobs.length > 0 || result.pendingJobs.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
