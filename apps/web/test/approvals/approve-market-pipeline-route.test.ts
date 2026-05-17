import { describe, expect, it } from "vitest";
import type {
  ExecutionIntentRepository,
  MarketPipelineReadModel,
  MarketPipelineReadModelRepository,
  ReceivedExecutionIntent,
  StoredExecutionIntent
} from "@big-banana/domain";
import { contractFixture } from "../../../../packages/domain/test/helpers.js";
import { handleApproveMarketPipelineRequest } from "../../src/approvals/handle-approve-market-pipeline-request.js";

class InMemoryMarketPipelineReadModelRepository
  implements MarketPipelineReadModelRepository
{
  constructor(
    private readonly snapshots: Record<string, MarketPipelineReadModel> = {}
  ) {}

  async getLatestMarketPipeline(
    marketKey: string
  ): Promise<MarketPipelineReadModel | null> {
    return this.snapshots[marketKey] ?? null;
  }
}

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

function request(marketKey?: string): Request {
  const suffix = marketKey
    ? `?market_key=${encodeURIComponent(marketKey)}`
    : "";

  return new Request(
    `http://localhost/api/market-pipeline/approve${suffix}`,
    { method: "POST" }
  );
}

function reviewRequiredSnapshot(): MarketPipelineReadModel {
  const tradePlan = contractFixture("trade-plan.valid.json") as Record<
    string,
    any
  >;
  const riskVerdict = contractFixture("risk-verdict.valid.json") as Record<
    string,
    any
  >;

  return {
    marketKey: "BINANCE:BTCUSDT:240",
    marketState: null,
    tradePlanVersion: {
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
      createdAt: "2026-05-18T00:00:00.000Z"
    },
    riskVerdict: {
      id: "risk-1",
      tradePlanVersionId: "plan-version-1",
      tradingAccountId: "acct-1",
      verdict: riskVerdict.verdict,
      approvedRiskPct: riskVerdict.approved_risk_pct,
      approvedQty: riskVerdict.approved_qty,
      approvedNotional: riskVerdict.approved_notional,
      approvedStopPrice: riskVerdict.approved_stop_price,
      requireHumanApproval: riskVerdict.require_human_approval,
      checks: riskVerdict.checks,
      rejectionCodes: riskVerdict.rejection_codes,
      createdAt: "2026-05-18T00:01:00.000Z"
    },
    executionIntent: null
  };
}

describe("POST /api/market-pipeline/approve", () => {
  it("creates an execution intent for a manual-review market pipeline", async () => {
    const executionIntentRepository = new InMemoryExecutionIntentRepository();
    const response = await handleApproveMarketPipelineRequest(
      request("BINANCE:BTCUSDT:240"),
      new InMemoryMarketPipelineReadModelRepository({
        "BINANCE:BTCUSDT:240": reviewRequiredSnapshot()
      }),
      executionIntentRepository
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "intent_ready",
      execution_intent_id: executionIntentRepository.intents[0]?.id
    });
    expect(executionIntentRepository.intents).toHaveLength(1);
  });

  it("returns already_ready when the execution intent already exists", async () => {
    const response = await handleApproveMarketPipelineRequest(
      request("BINANCE:BTCUSDT:240"),
      new InMemoryMarketPipelineReadModelRepository({
        "BINANCE:BTCUSDT:240": {
          ...reviewRequiredSnapshot(),
          executionIntent: {
            id: "intent-1",
            tradePlanVersionId: "plan-version-1",
            riskVerdictId: "risk-1",
            tradingAccountId: "acct-1",
            payload: {
              action: "open",
              plan_version_id: "plan-version-1",
              trading_account_id: "acct-1",
              symbol: "BTCUSDT",
              side: "buy",
              order_type: "limit",
              time_in_force: "GTC",
              qty: 0.12,
              price: 67000,
              stop_price: 66800,
              reduce_only: false,
              client_order_id: "BTCUSDT-buy-v1",
              idempotency_key: "plan-version-1:risk-1:open"
            },
            createdAt: "2026-05-18T00:02:00.000Z"
          }
        }
      }),
      new InMemoryExecutionIntentRepository()
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: "already_ready",
      execution_intent_id: "intent-1"
    });
  });

  it("rejects approval when risk verdict does not require manual review", async () => {
    const response = await handleApproveMarketPipelineRequest(
      request("BINANCE:BTCUSDT:240"),
      new InMemoryMarketPipelineReadModelRepository({
        "BINANCE:BTCUSDT:240": {
          ...reviewRequiredSnapshot(),
          riskVerdict: {
            ...reviewRequiredSnapshot().riskVerdict!,
            requireHumanApproval: false
          }
        }
      }),
      new InMemoryExecutionIntentRepository()
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "approval_not_required"
    });
  });

  it("rejects missing market_key", async () => {
    const response = await handleApproveMarketPipelineRequest(
      request(),
      new InMemoryMarketPipelineReadModelRepository(),
      new InMemoryExecutionIntentRepository()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "missing_market_key"
    });
  });
});
