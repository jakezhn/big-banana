import { describe, expect, it } from "vitest";
import { validateExecutionIntent, type TradePlan } from "@big-banana/contracts";
import { fixture } from "../../contracts/test/helpers.js";
import {
  buildAndRecordExecutionIntentFromRiskVerdict,
  buildExecutionIntentFromApprovedRiskVerdict,
  type ExecutionIntentRepository,
  type ReceivedExecutionIntent,
  type StoredExecutionIntent,
  type StoredRiskVerdict,
  type StoredTradePlanVersion,
  UnsupportedExecutionIntentError
} from "../src/index.js";

class InMemoryExecutionIntentRepository implements ExecutionIntentRepository {
  readonly intents: StoredExecutionIntent[] = [];

  async recordExecutionIntent(
    intent: ReceivedExecutionIntent
  ): Promise<StoredExecutionIntent> {
    const stored = { ...intent, id: crypto.randomUUID() };
    this.intents.push(stored);
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

function riskVerdict(
  overrides?: Partial<StoredRiskVerdict>
): StoredRiskVerdict {
  return {
    id: "risk-1",
    tradePlanVersionId: "plan-version-1",
    tradingAccountId: "acct-1",
    verdict: "approve",
    approvedRiskPct: 0.5,
    approvedQty: 0.12,
    approvedNotional: 8040,
    approvedStopPrice: 66800,
    requireHumanApproval: false,
    checks: [],
    rejectionCodes: [],
    createdAt: "2026-05-17T11:00:00.000Z",
    ...overrides
  };
}

describe("buildExecutionIntentFromApprovedRiskVerdict", () => {
  it("builds a valid open execution intent from an approved verdict", () => {
    const intent = buildExecutionIntentFromApprovedRiskVerdict(
      tradePlanVersion(),
      riskVerdict()
    );

    expect(intent).toMatchObject({
      action: "open",
      plan_version_id: "plan-version-1",
      trading_account_id: "acct-1",
      symbol: "BTCUSDT",
      side: "buy",
      order_type: "limit",
      time_in_force: "GTC",
      qty: 0.12,
      stop_price: 66800,
      reduce_only: false
    });
    expect(validateExecutionIntent(intent)).toBe(true);
  });

  it("rejects non-approved risk verdicts", () => {
    expect(() =>
      buildExecutionIntentFromApprovedRiskVerdict(
        tradePlanVersion(),
        riskVerdict({
          verdict: "reject",
          approvedQty: null
        })
      )
    ).toThrow(UnsupportedExecutionIntentError);
  });

  it("records a built execution intent", async () => {
    const repository = new InMemoryExecutionIntentRepository();
    const stored = await buildAndRecordExecutionIntentFromRiskVerdict(
      tradePlanVersion(),
      riskVerdict(),
      repository,
      "2026-05-17T12:00:00.000Z"
    );

    expect(stored.tradePlanVersionId).toBe("plan-version-1");
    expect(stored.riskVerdictId).toBe("risk-1");
    expect(stored.createdAt).toBe("2026-05-17T12:00:00.000Z");
    expect(repository.intents).toHaveLength(1);
  });
});
