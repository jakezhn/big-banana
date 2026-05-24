import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload";

export type ReceivedMarketState = {
  marketKey: string;
  webhookEventId: string;
  tickerid: string;
  timeframe: string;
  barTimeMs: number;
  context: CanonicalEnvelope["context"];
  createdAt: string;
};

export type StoredMarketState = ReceivedMarketState & {
  id: string;
};

export interface MarketStateRepository {
  recordMarketState(state: ReceivedMarketState): Promise<StoredMarketState>;

  getLatestStatesByTickerid(tickerid: string): Promise<StoredMarketState[]>;

  getRecentMarketStatesByMarketKey(
    marketKey: string,
    limit: number
  ): Promise<StoredMarketState[]>;
}
