import { describe, expect, it } from "vitest";
import { validateTradePlan } from "@big-banana/contracts";
import { fixture } from "../../contracts/test/helpers.js";
import {
  generateDeterministicTradePlan,
  type PlannerInput
} from "../src/index.js";

function plannerInput(overrides?: Partial<PlannerInput>): PlannerInput {
  const signalPayload = fixture("signal.valid.json") as {
    context: PlannerInput["context"];
    signal: {
      direction: PlannerInput["signal"]["direction"];
      rank_level: PlannerInput["signal"]["rankLevel"];
      rank_pct: PlannerInput["signal"]["rankPct"];
      gain: PlannerInput["signal"]["gain"];
      pain: PlannerInput["signal"]["pain"];
      proposed_size: PlannerInput["signal"]["proposedSize"];
      regime: PlannerInput["signal"]["regime"];
      regime_alignement: PlannerInput["signal"]["regimeAlignment"];
      kl: {
        has_kl: PlannerInput["signal"]["kl"]["hasKl"];
        role: PlannerInput["signal"]["kl"]["role"];
        source: PlannerInput["signal"]["kl"]["source"];
      };
      divergence: {
        has_divergence: PlannerInput["signal"]["divergence"]["hasDivergence"];
      };
    };
  };

  return {
    signal: {
      direction: signalPayload.signal.direction,
      rankLevel: signalPayload.signal.rank_level,
      rankPct: signalPayload.signal.rank_pct,
      gain: signalPayload.signal.gain,
      pain: signalPayload.signal.pain,
      proposedSize: signalPayload.signal.proposed_size,
      regime: signalPayload.signal.regime,
      regimeAlignment: signalPayload.signal.regime_alignement,
      kl: {
        hasKl: signalPayload.signal.kl.has_kl,
        role: signalPayload.signal.kl.role,
        source: signalPayload.signal.kl.source
      },
      divergence: {
        hasDivergence: signalPayload.signal.divergence.has_divergence
      }
    },
    context: signalPayload.context,
    state: {
      latestSnapshots: {
        "BINANCE:BTCUSDT:240": signalPayload.context
      },
      recentSnapshots: [],
      windowSummary: {
        snapshotCount: 0,
        firstBarTimeMs: null,
        lastBarTimeMs: null,
        closeChangePct: null,
        rangeHigh: null,
        rangeLow: null,
        netDirection: "unknown",
        closeLocationInRangePct: null,
        distanceFromWindowHighPct: null,
        distanceFromWindowLowPct: null,
        latestAboveEma20: null,
        latestAboveEma50: null,
        latestAboveEma200: null,
        latestEmaStack: "unknown",
        extensionFromEma20Atr: null,
        extensionFromEma50Atr: null,
        higherHighCount: 0,
        higherLowCount: 0,
        lowerHighCount: 0,
        lowerLowCount: 0,
        latestBarRangePct: null,
        averageBarRangePct: null,
        latestVsAverageRangeRatio: null,
        momentumBias: "unknown",
        oscBias: "unknown",
        regimeSequence: []
      },
      activePlan: null,
      openOrders: [],
      openPosition: null
    },
    ...overrides
  };
}

describe("generateDeterministicTradePlan", () => {
  it("creates an armed trade plan for an aligned strong signal", () => {
    const result = generateDeterministicTradePlan(plannerInput());

    expect(result.action).toBe("create");
    expect(result.execution_playbook.state).toBe("armed");
    expect(result.market_thesis.bias).toBe("long");
    expect(validateTradePlan(result)).toBe(true);
  });

  it("returns a watch-mode non-trade plan when the signal is weak or misaligned", () => {
    const base = plannerInput();
    const result = generateDeterministicTradePlan({
      ...base,
      signal: {
        ...base.signal,
        rankLevel: 2,
        regimeAlignment: "counter",
        gain: 0.3,
        pain: 0.5
      }
    });

    expect(result.action).toBe("skip");
    expect(result.execution_playbook.state).toBe("watch");
    expect(result.market_thesis.bias).toBe("neutral");
    expect(validateTradePlan(result)).toBe(true);
  });
});
