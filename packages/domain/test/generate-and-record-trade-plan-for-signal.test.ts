import { describe, expect, it } from "vitest";
import {
  generateAndRecordTradePlanForSignal,
  type MarketStateRepository,
  type ReceivedMarketState,
  type ReceivedPlanTransition,
  type ReceivedTradePlanVersion,
  type StoredMarketState,
  type StoredPlanTransition,
  type StoredTradePlanVersion,
  type TradePlanVersionRepository,
  type ReceivedWebhookEvent,
  type StoredWebhookEvent,
  type WebhookEventRepository
} from "../src/index.js";
import { ingestTradingViewPayload } from "../src/webhook-events/ingest-tradingview-payload.js";
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
    const stored = { ...state, id: crypto.randomUUID() };
    this.states.set(state.marketKey, stored);
    return stored;
  }

  async getLatestStatesByTickerid(tickerid: string): Promise<StoredMarketState[]> {
    return [...this.states.values()].filter((state) => state.tickerid === tickerid);
  }
}

class InMemoryTradePlanVersionRepository implements TradePlanVersionRepository {
  readonly versions = new Map<string, StoredTradePlanVersion[]>();
  readonly transitions: StoredPlanTransition[] = [];

  async getLatestTradePlanVersion(
    planId: string
  ): Promise<StoredTradePlanVersion | null> {
    return (this.versions.get(planId) ?? []).at(-1) ?? null;
  }

  async getLatestTradePlanVersionByMarketKey(
    marketKey: string
  ): Promise<StoredTradePlanVersion | null> {
    const versions = [...this.versions.values()]
      .flat()
      .filter((version) => version.marketKey === marketKey);

    return versions.at(-1) ?? null;
  }

  async recordTradePlanVersion(
    version: ReceivedTradePlanVersion
  ): Promise<StoredTradePlanVersion> {
    const stored = { ...version, id: crypto.randomUUID() };
    const versions = this.versions.get(version.planId) ?? [];
    versions.push(stored);
    this.versions.set(version.planId, versions);
    return stored;
  }

  async recordPlanTransition(
    transition: ReceivedPlanTransition
  ): Promise<StoredPlanTransition> {
    const stored = { ...transition, id: crypto.randomUUID() };
    this.transitions.push(stored);
    return stored;
  }
}

describe("generateAndRecordTradePlanForSignal", () => {
  it("builds planner input, generates a plan, and persists the first version", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();
    const planRepository = new InMemoryTradePlanVersionRepository();
    const snapshot = contractFixture("snapshot.valid.json") as {
      context: ReceivedMarketState["context"];
    };

    await marketStateRepository.recordMarketState({
      marketKey: "BINANCE:BTCUSDT:240",
      webhookEventId: crypto.randomUUID(),
      tickerid: "BINANCE:BTCUSDT",
      timeframe: "240",
      barTimeMs: 1778419200000,
      context: snapshot.context,
      createdAt: "2026-05-17T10:00:00.000Z"
    });

    const ingestion = await ingestTradingViewPayload(
      contractFixture("signal.valid.json"),
      webhookRepository,
      "2026-05-17T10:01:00.000Z"
    );

    const result = await generateAndRecordTradePlanForSignal(
      ingestion.envelope,
      marketStateRepository,
      planRepository
    );

    expect(result.tradePlan.action).toBe("create");
    expect(result.recordResult.tradePlanVersion.version).toBe(1);
    expect(result.recordResult.planTransition?.toState).toBe("armed");
  });

  it("reuses the active plan id and emits a patch on subsequent aligned signals", async () => {
    const webhookRepository = new InMemoryWebhookEventRepository();
    const marketStateRepository = new InMemoryMarketStateRepository();
    const planRepository = new InMemoryTradePlanVersionRepository();
    const snapshot = contractFixture("snapshot.valid.json") as {
      context: ReceivedMarketState["context"];
    };

    await marketStateRepository.recordMarketState({
      marketKey: "BINANCE:BTCUSDT:240",
      webhookEventId: crypto.randomUUID(),
      tickerid: "BINANCE:BTCUSDT",
      timeframe: "240",
      barTimeMs: 1778419200000,
      context: snapshot.context,
      createdAt: "2026-05-17T10:00:00.000Z"
    });

    const first = await ingestTradingViewPayload(
      contractFixture("signal.valid.json"),
      webhookRepository
    );
    const firstResult = await generateAndRecordTradePlanForSignal(
      first.envelope,
      marketStateRepository,
      planRepository
    );

    const second = await ingestTradingViewPayload(
      contractFixture("signal.valid.json"),
      webhookRepository
    );
    const secondResult = await generateAndRecordTradePlanForSignal(
      second.envelope,
      marketStateRepository,
      planRepository
    );

    expect(secondResult.tradePlan.action).toBe("patch");
    expect(secondResult.recordResult.tradePlanVersion.planId).toBe(
      firstResult.recordResult.tradePlanVersion.planId
    );
    expect(secondResult.recordResult.tradePlanVersion.version).toBe(2);
  });
});
