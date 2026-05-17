import { describe, expect, it } from "vitest";
import type { TradePlan } from "@big-banana/contracts";
import { fixture } from "../../contracts/test/helpers.js";
import {
  InvalidPlanStateTransitionError,
  recordGeneratedTradePlan,
  type ReceivedPlanTransition,
  type ReceivedTradePlanVersion,
  type StoredPlanTransition,
  type StoredTradePlanVersion,
  type TradePlanVersionRepository
} from "../src/index.js";

class InMemoryTradePlanVersionRepository implements TradePlanVersionRepository {
  readonly versions = new Map<string, StoredTradePlanVersion[]>();
  readonly transitions: StoredPlanTransition[] = [];

  async getLatestTradePlanVersion(
    planId: string
  ): Promise<StoredTradePlanVersion | null> {
    const versions = this.versions.get(planId) ?? [];
    return versions.at(-1) ?? null;
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

function validTradePlan(overrides?: Partial<TradePlan>): TradePlan {
  return {
    ...(fixture("trade-plan.valid.json") as TradePlan),
    ...overrides
  };
}

describe("recordGeneratedTradePlan", () => {
  it("records the first version and initial transition", async () => {
    const repository = new InMemoryTradePlanVersionRepository();
    const result = await recordGeneratedTradePlan(
      {
        tradePlan: validTradePlan(),
        marketKey: "BINANCE:BTCUSDT:240",
        sourceEventKey: "BINANCE:BTCUSDT:240:1778404800000:signal",
        planId: "8c147f74-c191-424f-bf27-67cb5b43530c",
        createdAt: "2026-05-17T15:00:00.000Z"
      },
      repository
    );

    expect(result.tradePlanVersion).toMatchObject({
      planId: "8c147f74-c191-424f-bf27-67cb5b43530c",
      version: 1,
      marketKey: "BINANCE:BTCUSDT:240",
      action: "create"
    });
    expect(result.planTransition).toMatchObject({
      fromState: null,
      toState: "armed",
      reasonCode: "plan_generated"
    });
  });

  it("increments version without writing a transition when state is unchanged", async () => {
    const repository = new InMemoryTradePlanVersionRepository();
    const planId = "43364b71-c83b-4df0-8dcc-fef38df2458b";

    await recordGeneratedTradePlan(
      {
        tradePlan: validTradePlan(),
        marketKey: "BINANCE:BTCUSDT:240",
        sourceEventKey: "event-1",
        planId
      },
      repository
    );

    const result = await recordGeneratedTradePlan(
      {
        tradePlan: validTradePlan({
          action: "patch",
          reasoning_summary: "Same state, updated thesis."
        }),
        marketKey: "BINANCE:BTCUSDT:240",
        sourceEventKey: "event-2",
        planId
      },
      repository
    );

    expect(result.tradePlanVersion.version).toBe(2);
    expect(result.planTransition).toBeNull();
    expect(repository.transitions).toHaveLength(1);
  });

  it("records valid state transitions across versions", async () => {
    const repository = new InMemoryTradePlanVersionRepository();
    const planId = "1014f576-7225-42f4-9574-d32749f4875f";

    await recordGeneratedTradePlan(
      {
        tradePlan: validTradePlan(),
        marketKey: "BINANCE:BTCUSDT:240",
        sourceEventKey: "event-1",
        planId
      },
      repository
    );

    const result = await recordGeneratedTradePlan(
      {
        tradePlan: validTradePlan({
          action: "patch",
          execution_playbook: {
            ...validTradePlan().execution_playbook,
            state: "pending_entry"
          }
        }),
        marketKey: "BINANCE:BTCUSDT:240",
        sourceEventKey: "event-2",
        planId,
        transitionReasonCode: "trigger_confirmed"
      },
      repository
    );

    expect(result.tradePlanVersion.version).toBe(2);
    expect(result.planTransition).toMatchObject({
      fromState: "armed",
      toState: "pending_entry",
      reasonCode: "trigger_confirmed"
    });
  });

  it("rejects invalid state transitions", async () => {
    const repository = new InMemoryTradePlanVersionRepository();
    const planId = "ca6ccd4d-1432-4ba9-95d0-ac6470af9b5c";

    await recordGeneratedTradePlan(
      {
        tradePlan: validTradePlan({
          execution_playbook: {
            ...validTradePlan().execution_playbook,
            state: "watch"
          }
        }),
        marketKey: "BINANCE:BTCUSDT:240",
        sourceEventKey: "event-1",
        planId
      },
      repository
    );

    await expect(
      recordGeneratedTradePlan(
        {
          tradePlan: validTradePlan({
            action: "patch",
            execution_playbook: {
              ...validTradePlan().execution_playbook,
              state: "entered"
            }
          }),
          marketKey: "BINANCE:BTCUSDT:240",
          sourceEventKey: "event-2",
          planId
        },
        repository
      )
    ).rejects.toBeInstanceOf(InvalidPlanStateTransitionError);
  });

  it("does not write a transition for skip plans", async () => {
    const repository = new InMemoryTradePlanVersionRepository();
    const result = await recordGeneratedTradePlan(
      {
        tradePlan: validTradePlan({
          action: "skip",
          execution_playbook: {
            ...validTradePlan().execution_playbook,
            state: "watch"
          }
        }),
        marketKey: "BINANCE:BTCUSDT:240",
        sourceEventKey: "event-1"
      },
      repository
    );

    expect(result.planTransition).toBeNull();
    expect(repository.transitions).toHaveLength(0);
  });
});
