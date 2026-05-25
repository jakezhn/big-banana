import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ReplayPlannerFixture } from "./replay-planner-harness";
import type { ReplayPlannerBatchRunResult } from "./replay-planner-batch";
import {
  compareReplayPlannerQualityReports,
  type ReplayPlannerQualityComparison
} from "./replay-planner-quality";

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

export type ReplayPlannerBatchReportComparison = {
  baselineGeneratedAt: string;
  candidateGeneratedAt: string;
  sharedFixtureIds: string[];
  baselineOnlyFixtureIds: string[];
  candidateOnlyFixtureIds: string[];
  qualityComparison: ReplayPlannerQualityComparison;
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

export async function readReplayPlannerBatchReport(
  inputPath: string
): Promise<ReplayPlannerBatchReport> {
  return JSON.parse(await readFile(inputPath, "utf8")) as ReplayPlannerBatchReport;
}

export function compareReplayPlannerBatchReports(
  baseline: ReplayPlannerBatchReport,
  candidate: ReplayPlannerBatchReport
): ReplayPlannerBatchReportComparison {
  const baselineFixtures = new Set(baseline.fixtureIds);
  const candidateFixtures = new Set(candidate.fixtureIds);

  return {
    baselineGeneratedAt: baseline.generatedAt,
    candidateGeneratedAt: candidate.generatedAt,
    sharedFixtureIds: baseline.fixtureIds.filter((fixtureId) =>
      candidateFixtures.has(fixtureId)
    ),
    baselineOnlyFixtureIds: baseline.fixtureIds.filter(
      (fixtureId) => !candidateFixtures.has(fixtureId)
    ),
    candidateOnlyFixtureIds: candidate.fixtureIds.filter(
      (fixtureId) => !baselineFixtures.has(fixtureId)
    ),
    qualityComparison: compareReplayPlannerQualityReports(
      baseline.qualityReport,
      candidate.qualityReport
    )
  };
}
