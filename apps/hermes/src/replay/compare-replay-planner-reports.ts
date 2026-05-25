import {
  compareReplayPlannerBatchReports,
  readReplayPlannerBatchReport
} from "./replay-planner-report";

async function main(): Promise<void> {
  const [baselinePath, candidatePath] = process.argv.slice(2);

  if (!baselinePath || !candidatePath) {
    throw new Error(
      "Usage: pnpm --filter @big-banana/hermes replay:compare <baseline-report.json> <candidate-report.json>"
    );
  }

  const [baseline, candidate] = await Promise.all([
    readReplayPlannerBatchReport(baselinePath),
    readReplayPlannerBatchReport(candidatePath)
  ]);
  const comparison = compareReplayPlannerBatchReports(baseline, candidate);

  console.log(JSON.stringify(comparison, null, 2));
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
