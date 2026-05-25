import { describe, expect, it } from "vitest";
import type {
  MarketPipelineReadModel,
  MarketPipelineReadModelRepository
} from "@big-banana/domain";
import { contractFixture } from "../../../../packages/domain/test/helpers.js";
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
    const snapshot = contractFixture("snapshot.valid.json") as Record<
      string,
      any
    >;

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
            context: snapshot.context,
            createdAt: "2026-05-18T00:00:00.000Z"
          },
          tradePlanVersion: null,
          latestPlanRevisionSuggestion: null,
          latestPostPlanReview: null,
          memoryLessonCandidates: [],
          riskVerdict: null,
          executionIntent: null,
          latestOrder: null,
          latestFill: null,
          currentPosition: null
        }
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      data: {
        market_key: "BINANCE:BTCUSDT:240",
        pipeline_status: "normalized",
        market_state: expect.objectContaining({
          marketKey: "BINANCE:BTCUSDT:240"
        }),
        trade_plan_version: null,
        latest_plan_revision_suggestion: null,
        latest_post_plan_review: null,
        memory_lesson_candidates: [],
        risk_verdict: null,
        execution_intent: null,
        latest_order: null,
        latest_fill: null,
        current_position: null
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
