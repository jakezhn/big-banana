import { describe, expect, it } from "vitest";
import { buildPlannerInput, SignalPlannerInputError } from "../src/planner/build-planner-input.js";
import type {
  MarketStateRepository,
  ReceivedMarketState,
  StoredMarketState
} from "../src/market-state/market-state-repository.js";
import { ingestTradingViewPayload } from "../src/webhook-events/ingest-tradingview-payload.js";
import type {
  ReceivedWebhookEvent,
  StoredWebhookEvent,
  WebhookEventRepository
} from "../src/webhook-events/webhook-event-repository.js";
import { contractFixture } from "./helpers.js";

class InMemoryWebhookEventRepository implements WebhookEventRepository {
  readonly events = new Map<string, StoredWebhookEvent>();

  async recordReceivedEvent(
    event: ReceivedWebhookEvent
  ): Promise<StoredWebhookEvent> {
    const stored = {
      ...event,
      id: crypto.randomUUID(),
      lastReceivedAt: event.receivedAt,
      deliveryCount: 1,
      duplicate: false,
      processStatus: "received"
    };

    this.events.set(event.deliveryKey, stored);
    return stored;
  }

  async updateProcessStatus(): Promise<void> {}
}

class InMemoryMarketStateRepository implements MarketStateRepository {
  readonly states = new Map<string, StoredMarketState>();

  async recordMarketState(
    state: ReceivedMarketState
  ): Promise<StoredMarketState> {
    const stored = {
      ...state,
      id: crypto.randomUUID()
    };
    this.states.set(state.marketKey, stored);
    return stored;
  }

  async getLatestStatesByTickerid(tickerid: string): Promise<StoredMarketState[]> {
    return [...this.states.values()].filter((state) => state.tickerid === tickerid);
  }
}

describe("buildPlannerInput", () => {
  it("builds minimal planner input from a signal and latest stored snapshots", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();

    await marketStateRepository.recordMarketState({
      marketKey: "BINANCE:BTCUSDT:240",
      webhookEventId: crypto.randomUUID(),
      tickerid: "BINANCE:BTCUSDT",
      timeframe: "240",
      barTimeMs: 1778419200000,
      context: (contractFixture("snapshot.valid.json") as {
        context: ReceivedMarketState["context"];
      }).context,
      createdAt: "2026-05-17T10:00:00.000Z"
    });

    const ingestion = await ingestTradingViewPayload(
      contractFixture("signal.valid.json"),
      webhookRepository,
      "2026-05-17T10:01:00.000Z"
    );

    const plannerInput = await buildPlannerInput(
      ingestion.envelope,
      marketStateRepository
    );

    expect(plannerInput.signal).toMatchObject({
      direction: "long",
      rankLevel: 4,
      rankPct: 0.83,
      proposedSize: 0.72,
      regimeAlignment: "align"
    });
    expect(plannerInput.state.latestSnapshots["BINANCE:BTCUSDT:240"]).toMatchObject({
      market: {
        timeframe: "240"
      }
    });
    expect(plannerInput.state.openOrders).toEqual([]);
  });

  it("rejects snapshot payloads", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();
    const ingestion = await ingestTradingViewPayload(
      contractFixture("snapshot.valid.json"),
      webhookRepository,
      "2026-05-17T10:00:00.000Z"
    );

    await expect(
      buildPlannerInput(ingestion.envelope, marketStateRepository)
    ).rejects.toBeInstanceOf(SignalPlannerInputError);
  });
});
