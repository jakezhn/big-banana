import type { StoredFill } from "../fills/fill-repository";
import type {
  PositionHistoryEventType,
  PositionRepository,
  PositionSide,
  PositionUpdateFromFillResult,
  StoredPositionSnapshot
} from "./position-repository";

type ApplyFillToPositionInput = {
  marketKey: string;
  fill: StoredFill;
};

export async function applyFillToPosition(
  input: ApplyFillToPositionInput,
  repository: PositionRepository
): Promise<PositionUpdateFromFillResult> {
  const current = await repository.getCurrentPosition(
    input.fill.tradingAccountId,
    input.fill.symbol
  );
  const nextState = deriveNextPositionState(current, input);

  const currentPosition = await repository.upsertCurrentPosition({
    tradingAccountId: input.fill.tradingAccountId,
    symbol: input.fill.symbol,
    marketKey: input.marketKey,
    positionSide: nextState.positionSide,
    signedQty: nextState.signedQty,
    avgEntryPrice: nextState.avgEntryPrice,
    openedAt: nextState.openedAt,
    closedAt: nextState.closedAt,
    updatedAt: input.fill.filledAt,
    lastFillId: input.fill.id
  });

  const historyEntry = await repository.recordPositionHistory({
    positionId: currentPosition.id,
    tradingAccountId: currentPosition.tradingAccountId,
    symbol: currentPosition.symbol,
    marketKey: currentPosition.marketKey,
    positionSide: currentPosition.positionSide,
    signedQty: currentPosition.signedQty,
    avgEntryPrice: currentPosition.avgEntryPrice,
    sourceFillId: input.fill.id,
    eventType: nextState.eventType,
    recordedAt: input.fill.filledAt
  });

  return {
    currentPosition,
    historyEntry
  };
}

type DerivedPositionState = {
  positionSide: PositionSide;
  signedQty: number;
  avgEntryPrice: number | null;
  openedAt: string | null;
  closedAt: string | null;
  eventType: PositionHistoryEventType;
};

function deriveNextPositionState(
  current: StoredPositionSnapshot | null,
  input: ApplyFillToPositionInput
): DerivedPositionState {
  const currentQty = current?.signedQty ?? 0;
  const delta = input.fill.side === "buy" ? input.fill.qty : -input.fill.qty;
  const nextQty = roundQty(currentQty + delta);
  const currentAbs = Math.abs(currentQty);
  const nextAbs = Math.abs(nextQty);
  const currentSign = Math.sign(currentQty);
  const deltaSign = Math.sign(delta);
  const nextSign = Math.sign(nextQty);
  const fillPrice = input.fill.price;

  if (currentQty === 0) {
    return {
      positionSide: sideFromSignedQty(nextQty),
      signedQty: nextQty,
      avgEntryPrice: nextAbs === 0 ? null : fillPrice,
      openedAt: nextAbs === 0 ? null : input.fill.filledAt,
      closedAt: nextAbs === 0 ? input.fill.filledAt : null,
      eventType: "open"
    };
  }

  if (nextQty === 0) {
    return {
      positionSide: "flat",
      signedQty: 0,
      avgEntryPrice: null,
      openedAt: current?.openedAt ?? input.fill.filledAt,
      closedAt: input.fill.filledAt,
      eventType: "close"
    };
  }

  if (currentSign === deltaSign) {
    const weightedPrice =
      ((currentAbs * (current?.avgEntryPrice ?? fillPrice)) +
        input.fill.qty * fillPrice) /
      nextAbs;

    return {
      positionSide: sideFromSignedQty(nextQty),
      signedQty: nextQty,
      avgEntryPrice: roundPrice(weightedPrice),
      openedAt: current?.openedAt ?? input.fill.filledAt,
      closedAt: null,
      eventType: "increase"
    };
  }

  if (currentSign === nextSign) {
    return {
      positionSide: sideFromSignedQty(nextQty),
      signedQty: nextQty,
      avgEntryPrice: current?.avgEntryPrice ?? null,
      openedAt: current?.openedAt ?? input.fill.filledAt,
      closedAt: null,
      eventType: "reduce"
    };
  }

  return {
    positionSide: sideFromSignedQty(nextQty),
    signedQty: nextQty,
    avgEntryPrice: fillPrice,
    openedAt: input.fill.filledAt,
    closedAt: null,
    eventType: "flip"
  };
}

function sideFromSignedQty(signedQty: number): PositionSide {
  if (signedQty > 0) {
    return "long";
  }

  if (signedQty < 0) {
    return "short";
  }

  return "flat";
}

function roundQty(value: number): number {
  return Number(value.toFixed(8));
}

function roundPrice(value: number): number {
  return Number(value.toFixed(8));
}
