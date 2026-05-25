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
  buildDefaultReplayPlannerComparisonPath,
  buildDefaultReplayPlannerReportPath,
  buildReplayPlannerBatchReport,
  compareReplayPlannerBatchReports,
  findLatestReplayPlannerBatchReportPath,
  readReplayPlannerBatchReport,
  writeReplayPlannerBatchReport,
  writeReplayPlannerBatchReportComparison
} from "./replay-planner-report";
import { createReplayPlannerHandler } from "../worker/replay/replay-planner-handler";
import { AgentJobWorker } from "../worker/agent-job-worker";

async function main(): Promise<void> {
  const config = getHermesWorkerConfigFromEnv();
  const generatedAt = new Date().toISOString();
  const reportPath =
    process.env.HERMES_REPLAY_REPORT_PATH ??
    buildDefaultReplayPlannerReportPath(generatedAt);
  const previousReportPath = await findLatestReplayPlannerBatchReportPath();

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
    { jobRepository, worker },
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

  await writeReplayPlannerBatchReport(report, reportPath);

  let comparisonPath: string | null = null;
  let comparison: ReturnType<typeof compareReplayPlannerBatchReports> | null = null;

  if (previousReportPath && previousReportPath !== reportPath) {
    const previousReport = await readReplayPlannerBatchReport(previousReportPath);
    comparison = compareReplayPlannerBatchReports(previousReport, report);
    comparisonPath =
      process.env.HERMES_REPLAY_COMPARISON_PATH ??
      buildDefaultReplayPlannerComparisonPath(generatedAt);
    await writeReplayPlannerBatchReportComparison(comparison, comparisonPath);
  }

  console.log(
    JSON.stringify(
      {
        reportPath,
        previousReportPath,
        comparisonPath,
        report,
        comparison
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
