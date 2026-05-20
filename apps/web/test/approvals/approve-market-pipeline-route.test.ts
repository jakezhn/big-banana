import { describe, expect, it } from "vitest";
import type {
  ReceivedExecutionIntent,
  ExecutionIntentRepository,
  MarketPipelineReadModelRepository,
  StoredExecutionIntent
} from "@big-banana/domain";
import { handleApproveMarketPipelineRequest } from "../../src/approvals/handle-approve-market-pipeline-request.js";

class InMemoryMarketPipelineReadModelRepository
  implements MarketPipelineReadModelRepository
{
  async getLatestMarketPipeline() {
    return null;
  }
}

class InMemoryExecutionIntentRepository implements ExecutionIntentRepository {
  async recordExecutionIntent(
    _intent: ReceivedExecutionIntent
  ): Promise<StoredExecutionIntent> {
    throw new Error("approve route should not persist execution intents");
  }
}

describe("POST /api/market-pipeline/approve", () => {
  it("returns 410 because the manual-approval gate has been removed", async () => {
    const response = await handleApproveMarketPipelineRequest(
      new Request(
        "http://localhost/api/market-pipeline/approve?market_key=BINANCE:BTCUSDT:240",
        { method: "POST" }
      ),
      new InMemoryMarketPipelineReadModelRepository(),
      new InMemoryExecutionIntentRepository()
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "approval_removed"
    });
  });
});
