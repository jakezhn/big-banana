import { describe, expect, it } from "vitest";
import type {
  MarketPipelineReadModel,
  MarketPipelineReadModelRepository
} from "@big-banana/domain";
import { handleGetMarketPipelineRequest } from "../../src/markets/handle-get-market-pipeline-request.js";

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

function request(marketKey?: string): Request {
  const suffix = marketKey
    ? `?market_key=${encodeURIComponent(marketKey)}`
    : "";

  return new Request(`http://localhost/api/market-pipeline${suffix}`);
}

describe("GET /api/market-pipeline", () => {
  it("returns the latest pipeline snapshot for a market key", async () => {
    const response = await handleGetMarketPipelineRequest(
      request("BINANCE:BTCUSDT:240"),
      new InMemoryMarketPipelineReadModelRepository({
        "BINANCE:BTCUSDT:240": {
          marketKey: "BINANCE:BTCUSDT:240",
          marketState: {
            id: "state-1",
            marketKey: "BINANCE:BTCUSDT:240",
            webhookEventId: "event-1",
            tickerid: "BINANCE:BTCUSDT",
            timeframe: "240",
            barTimeMs: 1778419200000,
            context: {
              market: {
                tickerid: "BINANCE:BTCUSDT",
                timeframe: "240",
                bar_ts: "2026-05-09T08:00:00.000Z"
              },
              zones: { demand: null, supply: null },
              indicators: {
                ema9: null,
                ema21: null,
                ema200: null,
                bb_basis: null,
                bbw_pct: null,
                atr: null,
                volume_ratio: null,
                rsi: null,
                adx: null,
                funding_rate: null,
                oi_delta_pct: null
              },
              structure: {
                session: null,
                regime: null,
                trend_bias: null
              },
              levels: {
                prev_day_high: null,
                prev_day_low: null,
                prev_week_high: null,
                prev_week_low: null
              }
            },
            createdAt: "2026-05-18T00:00:00.000Z"
          },
          tradePlanVersion: null,
          riskVerdict: null,
          executionIntent: null
        }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        market_key: "BINANCE:BTCUSDT:240",
        market_state: expect.objectContaining({
          marketKey: "BINANCE:BTCUSDT:240"
        }),
        trade_plan_version: null,
        risk_verdict: null,
        execution_intent: null
      }
    });
  });

  it("rejects missing market_key", async () => {
    const response = await handleGetMarketPipelineRequest(
      request(),
      new InMemoryMarketPipelineReadModelRepository()
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "missing_market_key"
    });
  });

  it("returns 404 when no market snapshot exists", async () => {
    const response = await handleGetMarketPipelineRequest(
      request("BINANCE:ETHUSDT:240"),
      new InMemoryMarketPipelineReadModelRepository()
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "not_found"
    });
  });
});
