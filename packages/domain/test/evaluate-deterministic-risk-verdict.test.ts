import { describe, expect, it } from "vitest";
import { validateRiskVerdict, type TradePlan } from "@big-banana/contracts";
import { fixture } from "../../contracts/test/helpers.js";
import {
  evaluateAndRecordDeterministicRiskVerdict,
  evaluateDeterministicRiskVerdict,
  type ReceivedRiskVerdict,
  type RiskPolicySnapshot,
  type RiskVerdictRepository,
  type StoredRiskVerdict,
  type StoredTradePlanVersion
} from "../src/index.js";

class InMemoryRiskVerdictRepository implements RiskVerdictRepository {
  readonly verdicts: StoredRiskVerdict[] = [];

  async recordRiskVerdict(
    verdict: ReceivedRiskVerdict
  ): Promise<StoredRiskVerdict> {
    const stored = { ...verdict, id: crypto.randomUUID() };
    this.verdicts.push(stored);
    return stored;
  }
}

function tradePlanVersion(
  overrides?: Partial<StoredTradePlanVersion>
): StoredTradePlanVersion {
  const tradePlan = fixture("trade-plan.valid.json") as TradePlan;

  return {
    id: "plan-version-1",
    planId: "plan-1",
    version: 1,
    marketKey: "BINANCE:BTCUSDT:240",
    sourceEventKey: "event-1",
    action: tradePlan.action,
    marketThesis: tradePlan.market_thesis,
    executionPlaybook: tradePlan.execution_playbook,
    riskIntent: tradePlan.risk_intent,
    reasoningSummary: tradePlan.reasoning_summary,
    evidence: tradePlan.evidence,
    createdAt: "2026-05-17T10:00:00.000Z",
    ...overrides
  };
}

function riskPolicy(
  overrides?: Partial<RiskPolicySnapshot>
): RiskPolicySnapshot {
  return {
    tradingAccountId: "acct-1",
    accountEquity: 10000,
    maxTradeRiskPct: 1,
    maxNotional: 50000,
    maxLeverage: 3,
    requestedLeverage: 2,
    dailyLossLimitBreached: false,
    consecutiveLossLimitBreached: false,
    killSwitchEnabled: false,
    liveRequiresManualApproval: true,
    ...overrides
  };
}

describe("evaluateDeterministicRiskVerdict", () => {
  it("approves an aligned opening trade plan within policy", () => {
    const verdict = evaluateDeterministicRiskVerdict(
      tradePlanVersion(),
      riskPolicy()
    );

    expect(verdict.verdict).toBe("approve");
    expect(verdict.approved_risk_pct).toBe(0.5);
    expect(verdict.approved_qty).not.toBeNull();
    expect(verdict.require_human_approval).toBe(true);
    expect(validateRiskVerdict(verdict)).toBe(true);
  });

  it("approves with reduction when requested risk exceeds policy", () => {
    const verdict = evaluateDeterministicRiskVerdict(
      tradePlanVersion({
        riskIntent: {
          ...tradePlanVersion().riskIntent,
          suggested_max_account_risk_pct: 2
        }
      }),
      riskPolicy({
        maxTradeRiskPct: 1
      })
    );

    expect(verdict.verdict).toBe("approve_with_reduction");
    expect(verdict.approved_risk_pct).toBe(1);
    expect(verdict.rejection_codes).toEqual([]);
    expect(verdict.checks.some((check) => check.code === "MAX_TRADE_RISK" && check.status === "warn")).toBe(true);
  });

  it("rejects when the kill switch is enabled for an opening action", () => {
    const verdict = evaluateDeterministicRiskVerdict(
      tradePlanVersion(),
      riskPolicy({
        killSwitchEnabled: true
      })
    );

    expect(verdict.verdict).toBe("reject");
    expect(verdict.rejection_codes).toContain("KILL_SWITCH");
  });

  it("rejects when no executable entry zone exists", () => {
    const verdict = evaluateDeterministicRiskVerdict(
      tradePlanVersion({
        executionPlaybook: {
          ...tradePlanVersion().executionPlaybook,
          entry_zone: {
            low: null,
            high: null,
            source: "structure"
          }
        }
      }),
      riskPolicy()
    );

    expect(verdict.verdict).toBe("reject");
    expect(verdict.rejection_codes).toContain("ENTRY_ZONE_READY");
    expect(verdict.rejection_codes).toContain("REQUIRE_STOP");
  });

  it("records a valid risk verdict", async () => {
    const repository = new InMemoryRiskVerdictRepository();
    const stored = await evaluateAndRecordDeterministicRiskVerdict(
      tradePlanVersion(),
      riskPolicy(),
      repository,
      "2026-05-17T12:00:00.000Z"
    );

    expect(stored.tradePlanVersionId).toBe("plan-version-1");
    expect(stored.tradingAccountId).toBe("acct-1");
    expect(stored.createdAt).toBe("2026-05-17T12:00:00.000Z");
    expect(repository.verdicts).toHaveLength(1);
  });
});
