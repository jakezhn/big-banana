import type { SignalWebhookPayloadV12 } from "@big-banana/contracts";
import type { StoredMarketState } from "../market-state/market-state-repository";
import type { MarketStateRepository } from "../market-state/market-state-repository";
import type { StoredOrder, OrderRepository } from "../orders/order-repository";
import type { TradePlanVersionRepository, StoredTradePlanVersion } from "../plans/trade-plan-version-repository";
import type { PositionRepository, StoredPositionSnapshot } from "../positions/position-repository";
import { isTerminalPlanState } from "../state-machines/plan-state-machine";
import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload";

const DEFAULT_RECENT_SNAPSHOT_WINDOW = 12;

export type RecentPlannerSnapshot = {
  marketKey: string;
  tickerid: string;
  timeframe: string;
  barTimeMs: number;
  context: CanonicalEnvelope["context"];
};

export type PlannerWindowDirection =
  | "bull"
  | "bear"
  | "mixed"
  | "flat"
  | "unknown";

export type SnapshotWindowSummary = {
  snapshotCount: number;
  firstBarTimeMs: number | null;
  lastBarTimeMs: number | null;
  closeChangePct: number | null;
  rangeHigh: number | null;
  rangeLow: number | null;
  netDirection: PlannerWindowDirection;
  closeLocationInRangePct: number | null;
  distanceFromWindowHighPct: number | null;
  distanceFromWindowLowPct: number | null;
  latestAboveEma20: boolean | null;
  latestAboveEma50: boolean | null;
  latestAboveEma200: boolean | null;
  latestEmaStack: PlannerWindowDirection;
  extensionFromEma20Atr: number | null;
  extensionFromEma50Atr: number | null;
  higherHighCount: number;
  higherLowCount: number;
  lowerHighCount: number;
  lowerLowCount: number;
  latestBarRangePct: number | null;
  averageBarRangePct: number | null;
  latestVsAverageRangeRatio: number | null;
  momentumBias: PlannerWindowDirection;
  oscBias: PlannerWindowDirection;
  regimeSequence: string[];
};

export type PlannerInput = {
  signal: {
    direction: SignalWebhookPayloadV12["signal"]["direction"];
    rankLevel: SignalWebhookPayloadV12["signal"]["rank_level"];
    rankPct: SignalWebhookPayloadV12["signal"]["rank_pct"];
    gain: SignalWebhookPayloadV12["signal"]["gain"];
    pain: SignalWebhookPayloadV12["signal"]["pain"];
    proposedSize: SignalWebhookPayloadV12["signal"]["proposed_size"];
    regime: SignalWebhookPayloadV12["signal"]["regime"];
    regimeAlignment: SignalWebhookPayloadV12["signal"]["regime_alignement"];
    kl: {
      hasKl: SignalWebhookPayloadV12["signal"]["kl"]["has_kl"];
      role: SignalWebhookPayloadV12["signal"]["kl"]["role"];
      source: SignalWebhookPayloadV12["signal"]["kl"]["source"];
    };
    divergence: {
      hasDivergence: SignalWebhookPayloadV12["signal"]["divergence"]["has_divergence"];
    };
  };
  context: CanonicalEnvelope["context"];
  state: {
    latestSnapshots: Record<string, CanonicalEnvelope["context"]>;
    recentSnapshots: RecentPlannerSnapshot[];
    windowSummary: SnapshotWindowSummary;
    activePlan: StoredTradePlanVersion | null;
    openOrders: StoredOrder[];
    openPosition: StoredPositionSnapshot | null;
  };
};

export type PlannerInputBuildDependencies = {
  marketStateRepository: MarketStateRepository;
  tradePlanVersionRepository: TradePlanVersionRepository;
  orderRepository: OrderRepository;
  positionRepository: PositionRepository;
  tradingAccountId: string;
  recentSnapshotWindow?: number;
};

export class SignalPlannerInputError extends Error {
  constructor() {
    super("Planner input can only be built from signal payloads");
    this.name = "SignalPlannerInputError";
  }
}

export async function buildPlannerInput(
  envelope: CanonicalEnvelope,
  dependencies: PlannerInputBuildDependencies
): Promise<PlannerInput> {
  if (envelope.type !== "signal" || !envelope.signal) {
    throw new SignalPlannerInputError();
  }

  const recentSnapshotWindow =
    dependencies.recentSnapshotWindow ?? DEFAULT_RECENT_SNAPSHOT_WINDOW;

  const [
    latestStates,
    recentStates,
    latestPlanVersion,
    openOrders,
    openPosition
  ] = await Promise.all([
    dependencies.marketStateRepository.getLatestStatesByTickerid(
      envelope.context.market.tickerid
    ),
    dependencies.marketStateRepository.getRecentMarketStatesByMarketKey(
      envelope.marketKey,
      recentSnapshotWindow
    ),
    dependencies.tradePlanVersionRepository.getLatestTradePlanVersionByMarketKey(
      envelope.marketKey
    ),
    dependencies.orderRepository.getOpenOrdersByTradingAccountIdAndSymbol(
      dependencies.tradingAccountId,
      envelope.context.market.tickerid
    ),
    dependencies.positionRepository.getCurrentPosition(
      dependencies.tradingAccountId,
      envelope.context.market.tickerid
    )
  ]);

  const activePlan =
    latestPlanVersion &&
    !isTerminalPlanState(latestPlanVersion.executionPlaybook.state)
      ? latestPlanVersion
      : null;
  const recentSnapshots = recentStates.map(mapRecentPlannerSnapshot);

  return {
    signal: {
      direction: envelope.signal.direction,
      rankLevel: envelope.signal.rank_level,
      rankPct: envelope.signal.rank_pct,
      gain: envelope.signal.gain,
      pain: envelope.signal.pain,
      proposedSize: envelope.signal.proposed_size,
      regime: envelope.signal.regime,
      regimeAlignment: envelope.signal.regime_alignement,
      kl: {
        hasKl: envelope.signal.kl.has_kl,
        role: envelope.signal.kl.role,
        source: envelope.signal.kl.source
      },
      divergence: {
        hasDivergence: envelope.signal.divergence.has_divergence
      }
    },
    context: envelope.context,
    state: {
      latestSnapshots: Object.fromEntries(
        latestStates.map((state) => [state.marketKey, state.context])
      ),
      recentSnapshots,
      windowSummary: summarizeRecentSnapshots(recentSnapshots),
      activePlan,
      openOrders,
      openPosition
    }
  };
}

function mapRecentPlannerSnapshot(
  state: StoredMarketState
): RecentPlannerSnapshot {
  return {
    marketKey: state.marketKey,
    tickerid: state.tickerid,
    timeframe: state.timeframe,
    barTimeMs: state.barTimeMs,
    context: state.context
  };
}

function summarizeRecentSnapshots(
  snapshots: RecentPlannerSnapshot[]
): SnapshotWindowSummary {
  if (snapshots.length === 0) {
    return {
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
    };
  }

  const first = snapshots[0];
  const last = snapshots.at(-1) as RecentPlannerSnapshot;
  const firstClose = first.context.bar.close;
  const lastClose = last.context.bar.close;
  const closes = snapshots.map((snapshot) => snapshot.context.bar.close);
  const highs = snapshots.map((snapshot) => snapshot.context.bar.high);
  const lows = snapshots.map((snapshot) => snapshot.context.bar.low);
  const barRangePcts = snapshots
    .map((snapshot) =>
      percentOf(
        snapshot.context.bar.high - snapshot.context.bar.low,
        snapshot.context.bar.close
      )
    )
    .filter((value): value is number => value !== null);
  const momentumDirections = snapshots.map(
    (snapshot) => snapshot.context.momentum.direction
  );
  const oscDirections = snapshots.map((snapshot) => snapshot.context.osc.direction);
  const regimeSequence = snapshots.map((snapshot) => snapshot.context.regime.name);
  const rangeHigh = Math.max(...highs);
  const rangeLow = Math.min(...lows);
  const latestAtr = last.context.volatility.atr;
  const closeLocationInRangePct =
    rangeHigh === rangeLow
      ? 50
      : ((lastClose - rangeLow) / (rangeHigh - rangeLow)) * 100;
  const averageBarRangePct = average(barRangePcts);
  const latestBarRangePct =
    barRangePcts.length > 0 ? barRangePcts[barRangePcts.length - 1] : null;

  return {
    snapshotCount: snapshots.length,
    firstBarTimeMs: first.barTimeMs,
    lastBarTimeMs: last.barTimeMs,
    closeChangePct:
      firstClose === 0 ? null : ((lastClose - firstClose) / firstClose) * 100,
    rangeHigh,
    rangeLow,
    netDirection: inferNetDirection(firstClose, lastClose),
    closeLocationInRangePct,
    distanceFromWindowHighPct: percentOf(rangeHigh - lastClose, rangeHigh),
    distanceFromWindowLowPct: percentOf(lastClose - rangeLow, rangeLow),
    latestAboveEma20: lastClose >= last.context.structure.ema20,
    latestAboveEma50: lastClose >= last.context.structure.ema50,
    latestAboveEma200: lastClose >= last.context.structure.ema200,
    latestEmaStack: inferLatestEmaStack(last),
    extensionFromEma20Atr:
      latestAtr > 0 ? (lastClose - last.context.structure.ema20) / latestAtr : null,
    extensionFromEma50Atr:
      latestAtr > 0 ? (lastClose - last.context.structure.ema50) / latestAtr : null,
    higherHighCount: countDirectionalSteps(highs, "up"),
    higherLowCount: countDirectionalSteps(lows, "up"),
    lowerHighCount: countDirectionalSteps(highs, "down"),
    lowerLowCount: countDirectionalSteps(lows, "down"),
    latestBarRangePct,
    averageBarRangePct,
    latestVsAverageRangeRatio:
      latestBarRangePct === null || averageBarRangePct === null || averageBarRangePct === 0
        ? null
        : latestBarRangePct / averageBarRangePct,
    momentumBias: inferDirectionalBias(momentumDirections),
    oscBias: inferDirectionalBias(oscDirections),
    regimeSequence
  };
}

function inferNetDirection(
  firstClose: number,
  lastClose: number
): PlannerWindowDirection {
  if (firstClose === 0) {
    return "unknown";
  }

  const changePct = ((lastClose - firstClose) / firstClose) * 100;

  if (changePct > 0.25) {
    return "bull";
  }

  if (changePct < -0.25) {
    return "bear";
  }

  return "flat";
}

function inferDirectionalBias(directions: string[]): PlannerWindowDirection {
  if (directions.length === 0) {
    return "unknown";
  }

  const bullCount = directions.filter((direction) => direction === "bull").length;
  const bearCount = directions.filter((direction) => direction === "bear").length;

  if (bullCount > 0 && bearCount === 0) {
    return "bull";
  }

  if (bearCount > 0 && bullCount === 0) {
    return "bear";
  }

  if (bullCount === 0 && bearCount === 0) {
    return "flat";
  }

  return "mixed";
}

function inferLatestEmaStack(
  snapshot: RecentPlannerSnapshot
): PlannerWindowDirection {
  const { ema20, ema50, ema100, ema200 } = snapshot.context.structure;

  if (ema20 >= ema50 && ema50 >= ema100 && ema100 >= ema200) {
    return "bull";
  }

  if (ema20 <= ema50 && ema50 <= ema100 && ema100 <= ema200) {
    return "bear";
  }

  return "mixed";
}

function countDirectionalSteps(
  values: number[],
  direction: "up" | "down"
): number {
  let count = 0;

  for (let index = 1; index < values.length; index += 1) {
    if (direction === "up" && values[index] > values[index - 1]) {
      count += 1;
    }

    if (direction === "down" && values[index] < values[index - 1]) {
      count += 1;
    }
  }

  return count;
}

function average(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentOf(
  numerator: number,
  denominator: number
): number | null {
  if (denominator === 0) {
    return null;
  }

  return (numerator / denominator) * 100;
}
