import { describe, expect, it } from "vitest";
import type { JsonValue } from "@big-banana/domain";
import {
  buildReplayPlannerQualityReport,
  compareReplayPlannerQualityReports
} from "../src/replay/replay-planner-quality";

describe("buildReplayPlannerQualityReport", () => {
  it("derives actionable, watch, and execution eligibility rates", () => {
    const report = buildReplayPlannerQualityReport([
      createResultRef({
        market: "crypto",
        timeframe: "240",
        action: "create",
        executionState: "armed",
        executionEligible: true
      }),
      createResultRef({
        market: "crypto",
        timeframe: "240",
        action: "skip",
        executionState: "watch",
        executionEligible: false
      }),
      createResultRef({
        market: "us_equity",
        timeframe: "60",
        action: "create",
        executionState: "pending_entry",
        executionEligible: true
      })
    ]);

    expect(report.overall.totalRuns).toBe(3);
    expect(report.overall.executionEligibleRate).toBeCloseTo(2 / 3);
    expect(report.overall.actionableRate).toBeCloseTo(2 / 3);
    expect(report.overall.watchRate).toBeCloseTo(1 / 3);
    expect(report.overall.skipRate).toBeCloseTo(1 / 3);
    expect(report.byMarket.crypto.totalRuns).toBe(2);
    expect(report.byMarket.crypto.watchRate).toBeCloseTo(0.5);
    expect(report.byTimeframe["240"].totalRuns).toBe(2);
    expect(report.byPromptVersion["replay-v1"].totalRuns).toBe(3);
    expect(report.byModel["openai/gpt-5.4-mini"].createRate).toBeCloseTo(2 / 3);
  });
});

describe("compareReplayPlannerQualityReports", () => {
  it("computes rate deltas between baseline and candidate reports", () => {
    const baseline = buildReplayPlannerQualityReport([
      createResultRef({
        market: "crypto",
        timeframe: "240",
        action: "skip",
        executionState: "watch",
        executionEligible: false
      })
    ]);

    const candidate = buildReplayPlannerQualityReport([
      createResultRef({
        market: "crypto",
        timeframe: "240",
        action: "create",
        executionState: "armed",
        executionEligible: true
      })
    ]);

    const delta = compareReplayPlannerQualityReports(baseline, candidate);

    expect(delta.overall.executionEligibleRateDelta).toBe(1);
    expect(delta.overall.actionableRateDelta).toBe(1);
    expect(delta.overall.watchRateDelta).toBe(-1);
    expect(delta.byMarket.crypto.skipRateDelta).toBe(-1);
    expect(delta.byTimeframe["240"].createRateDelta).toBe(1);
  });
});

function createResultRef(input: {
  market: string;
  timeframe: string;
  action: string;
  executionState: string;
  executionEligible: boolean | null;
}): JsonValue {
  return {
    fixtureId: `${input.market}-${input.timeframe}`,
    jobType: "replay_planner",
    market: input.market,
    symbol: `${input.market}:symbol`,
    timeframe: input.timeframe,
    marketKey: `${input.market}:symbol:${input.timeframe}`,
    sourceEventKey: `${input.market}:evt`,
    agentRunId: `run-${input.market}-${input.timeframe}`,
    runnerKind: "openai",
    modelProvider: "openai",
    model: "openai/gpt-5.4-mini",
    promptVersion: "replay-v1",
    action: input.action,
    executionState: input.executionState,
    riskTier: "standard",
    executionEligible: input.executionEligible,
    tokenUsageJson: null
  };
}
