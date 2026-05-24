import { describe, expect, it } from "vitest";
import { defaultReplayPlannerFixtures } from "../src/replay/default-replay-planner-fixtures";
import {
  buildReplayPlannerJobInputFromFixture,
  parseReplayPlannerResultRef,
  summarizeReplayPlannerResultRefs
} from "../src/replay/replay-planner-harness";

describe("replay planner harness", () => {
  it("builds enqueue input from a fixture", () => {
    const fixture = defaultReplayPlannerFixtures[0]!;

    const job = buildReplayPlannerJobInputFromFixture(fixture, {
      priority: 2,
      maxAttempts: 4
    });

    expect(job).toMatchObject({
      jobType: "replay_planner",
      market: fixture.market,
      symbol: fixture.symbol,
      timeframe: fixture.timeframe,
      priority: 2,
      maxAttempts: 4,
      idempotencyKey: `replay:${fixture.market}:${fixture.symbol}:${fixture.timeframe}:${fixture.fixtureId}`
    });
    expect(job.payloadJson).toMatchObject({
      fixtureId: fixture.fixtureId,
      rawPayload: fixture.rawPayload,
      receivedAt: fixture.receivedAt
    });
  });

  it("summarizes replay result refs by action and eligibility", () => {
    const summary = summarizeReplayPlannerResultRefs([
      {
        fixtureId: "crypto-btc-4h-long",
        jobType: "replay_planner",
        market: "crypto",
        symbol: "BINANCE:BTCUSDT",
        timeframe: "240",
        marketKey: "BINANCE:BTCUSDT:240",
        sourceEventKey: "evt-1",
        agentRunId: "run-1",
        runnerKind: "deterministic",
        modelProvider: null,
        model: null,
        promptVersion: null,
        action: "create",
        executionState: "armed",
        riskTier: "standard",
        executionEligible: true,
        tokenUsageJson: null
      },
      {
        fixtureId: "commodity-gold-1d-watch",
        jobType: "replay_planner",
        market: "commodity",
        symbol: "OANDA:XAUUSD",
        timeframe: "1D",
        marketKey: "OANDA:XAUUSD:1D",
        sourceEventKey: "evt-2",
        agentRunId: "run-2",
        runnerKind: "deterministic",
        modelProvider: null,
        model: null,
        promptVersion: null,
        action: "skip",
        executionState: "watch",
        riskTier: "probe",
        executionEligible: false,
        tokenUsageJson: null
      }
    ]);

    expect(summary.totalRuns).toBe(2);
    expect(summary.executionEligibleCount).toBe(1);
    expect(summary.executionIneligibleCount).toBe(1);
    expect(summary.actionCounts).toEqual({ create: 1, skip: 1 });
    expect(summary.marketCounts).toEqual({ crypto: 1, commodity: 1 });
    expect(summary.timeframeCounts).toEqual({ "240": 1, "1D": 1 });
  });

  it("parses a replay planner result ref", () => {
    const parsed = parseReplayPlannerResultRef({
      fixtureId: "fx-1",
      jobType: "replay_planner",
      market: "crypto",
      symbol: "BINANCE:BTCUSDT",
      timeframe: "240",
      marketKey: "BINANCE:BTCUSDT:240",
      sourceEventKey: "evt-1",
      agentRunId: "run-1",
      runnerKind: "openai",
      modelProvider: "openai",
      model: "openai/gpt-5.4-mini",
      promptVersion: "openai-trade-plan-v3",
      action: "patch",
      executionState: "pending_entry",
      riskTier: "starter",
      executionEligible: true,
      tokenUsageJson: { total_tokens: 123 }
    });

    expect(parsed.fixtureId).toBe("fx-1");
    expect(parsed.runnerKind).toBe("openai");
    expect(parsed.executionEligible).toBe(true);
  });
});
