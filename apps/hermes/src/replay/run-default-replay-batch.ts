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
import {
  buildDefaultReplayPlannerReportPath,
  buildReplayPlannerBatchReport,
  writeReplayPlannerBatchReport
} from "./replay-planner-report";
import { createReplayPlannerHandler } from "../worker/replay/replay-planner-handler";
import { AgentJobWorker } from "../worker/agent-job-worker";

async function main(): Promise<void> {
  const config = getHermesWorkerConfigFromEnv();
  const generatedAt = new Date().toISOString();
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
      idempotencyPrefix: `replay-batch-${generatedAt}`,
      maxRuns: defaultReplayPlannerFixtures.length * 4
    }
  );
  const report = buildReplayPlannerBatchReport(
    defaultReplayPlannerFixtures,
    result,
    generatedAt
  );
  const reportPath =
    process.env.HERMES_REPLAY_REPORT_PATH ??
    buildDefaultReplayPlannerReportPath(generatedAt);

  await writeReplayPlannerBatchReport(report, reportPath);

  console.log(
    JSON.stringify(
      { reportPath, ...report },
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
