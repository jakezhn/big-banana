import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReplayPlannerFixture } from "./replay-planner-harness";
import type { ReplayPlannerBatchRunResult } from "./replay-planner-batch";

export type ReplayPlannerBatchReport = {
  generatedAt: string;
  fixtureIds: string[];
  totalFixtures: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  pendingJobs: number;
  summary: ReplayPlannerBatchRunResult["summary"];
  qualityReport: ReplayPlannerBatchRunResult["qualityReport"];
};

export function buildReplayPlannerBatchReport(
  fixtures: ReplayPlannerFixture[],
  result: ReplayPlannerBatchRunResult,
  generatedAt = new Date().toISOString()
): ReplayPlannerBatchReport {
  return {
    generatedAt,
    fixtureIds: fixtures.map((fixture) => fixture.fixtureId),
    totalFixtures: result.totalFixtures,
    completedJobs: result.completedJobs.length,
    failedJobs: result.failedJobs.length,
    cancelledJobs: result.cancelledJobs.length,
    pendingJobs: result.pendingJobs.length,
    summary: result.summary,
    qualityReport: result.qualityReport
  };
}

export function buildDefaultReplayPlannerReportPath(
  generatedAt: string,
  rootDir = path.join(process.cwd(), "artifacts", "replay-planner")
): string {
  const safeTimestamp = generatedAt.replaceAll(":", "-");
  return path.join(rootDir, `${safeTimestamp}.json`);
}

export async function writeReplayPlannerBatchReport(
  report: ReplayPlannerBatchReport,
  outputPath: string
): Promise<void> {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}
