import type { StoredFill } from "../fills/fill-repository";

export type PositionSide = "long" | "short" | "flat";
export type PositionHistoryEventType =
  | "open"
  | "increase"
  | "reduce"
  | "close"
  | "flip";

export type ReceivedPositionSnapshot = {
  tradingAccountId: string;
  symbol: string;
  marketKey: string;
  positionSide: PositionSide;
  signedQty: number;
  avgEntryPrice: number | null;
  openedAt: string | null;
  closedAt: string | null;
  updatedAt: string;
  lastFillId: string;
};

export type StoredPositionSnapshot = ReceivedPositionSnapshot & {
  id: string;
};

export type ReceivedPositionHistoryEntry = {
  positionId: string;
  tradingAccountId: string;
  symbol: string;
  marketKey: string;
  positionSide: PositionSide;
  signedQty: number;
  avgEntryPrice: number | null;
  sourceFillId: string;
  eventType: PositionHistoryEventType;
  recordedAt: string;
};

export type StoredPositionHistoryEntry = ReceivedPositionHistoryEntry & {
  id: string;
};

export interface PositionRepository {
  getCurrentPosition(
    tradingAccountId: string,
    symbol: string
  ): Promise<StoredPositionSnapshot | null>;

  upsertCurrentPosition(
    position: ReceivedPositionSnapshot
  ): Promise<StoredPositionSnapshot>;

  recordPositionHistory(
    entry: ReceivedPositionHistoryEntry
  ): Promise<StoredPositionHistoryEntry>;
}

export type PositionUpdateFromFillResult = {
  currentPosition: StoredPositionSnapshot;
  historyEntry: StoredPositionHistoryEntry;
};
