import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { defaultReplayPlannerFixtures } from "../src/replay/default-replay-planner-fixtures";
import {
  buildDefaultReplayPlannerReportPath,
  buildReplayPlannerBatchReport,
  writeReplayPlannerBatchReport
} from "../src/replay/replay-planner-report";
import type { ReplayPlannerBatchRunResult } from "../src/replay/replay-planner-batch";

describe("buildReplayPlannerBatchReport", () => {
  it("builds an archiveable report envelope from batch results", () => {
    const report = buildReplayPlannerBatchReport(
      defaultReplayPlannerFixtures,
      createBatchResult(),
      "2026-05-25T10:00:00.000Z"
    );

    expect(report.generatedAt).toBe("2026-05-25T10:00:00.000Z");
    expect(report.fixtureIds).toEqual(
      defaultReplayPlannerFixtures.map((fixture) => fixture.fixtureId)
    );
    expect(report.totalFixtures).toBe(defaultReplayPlannerFixtures.length);
    expect(report.completedJobs).toBe(3);
    expect(report.failedJobs).toBe(0);
    expect(report.summary.totalRuns).toBe(3);
    expect(report.qualityReport.overall.executionEligibleRate).toBeCloseTo(2 / 3);
  });
});

describe("writeReplayPlannerBatchReport", () => {
  it("writes a JSON replay report to disk", async () => {
    const generatedAt = "2026-05-25T10:00:00.000Z";
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "bb-replay-report-"));
    const reportPath = buildDefaultReplayPlannerReportPath(generatedAt, tempDir);
    const report = buildReplayPlannerBatchReport(
      defaultReplayPlannerFixtures,
      createBatchResult(),
      generatedAt
    );

    await writeReplayPlannerBatchReport(report, reportPath);

    const written = JSON.parse(await readFile(reportPath, "utf8")) as {
      generatedAt: string;
      totalFixtures: number;
      qualityReport: { overall: { actionableRate: number } };
    };

    expect(written.generatedAt).toBe(generatedAt);
    expect(written.totalFixtures).toBe(defaultReplayPlannerFixtures.length);
    expect(written.qualityReport.overall.actionableRate).toBeCloseTo(2 / 3);
  });
});

function createBatchResult(): ReplayPlannerBatchRunResult {
  return {
    totalFixtures: defaultReplayPlannerFixtures.length,
    completedJobs: [{ id: "1" }, { id: "2" }, { id: "3" }] as ReplayPlannerBatchRunResult["completedJobs"],
    failedJobs: [],
    cancelledJobs: [],
    pendingJobs: [],
    summary: {
      totalRuns: 3,
      executionEligibleCount: 2,
      executionIneligibleCount: 1,
      unknownExecutionEligibilityCount: 0,
      actionCounts: { create: 2, skip: 1 },
      executionStateCounts: { armed: 1, pending_entry: 1, watch: 1 },
      riskTierCounts: { standard: 2, probe: 1 },
      marketCounts: { crypto: 1, us_equity: 1, commodity: 1 },
      timeframeCounts: { "240": 1, "60": 1, "1D": 1 },
      runnerKindCounts: { openai: 3 },
      promptVersionCounts: { "replay-v1": 3 },
      modelCounts: { "openai/gpt-5.4-mini": 3 }
    },
    qualityReport: {
      overall: {
        totalRuns: 3,
        executionEligibleCount: 2,
        executionIneligibleCount: 1,
        unknownExecutionEligibilityCount: 0,
        actionableCount: 2,
        watchCount: 1,
        skipCount: 1,
        createCount: 2,
        patchCount: 0,
        executionEligibleRate: 2 / 3,
        actionableRate: 2 / 3,
        watchRate: 1 / 3,
        skipRate: 1 / 3,
        createRate: 2 / 3,
        patchRate: 0
      },
      byMarket: {},
      byTimeframe: {},
      byPromptVersion: {},
      byModel: {}
    },
    workerRuns: []
  };
}
