import type { TradingViewIngestionResult } from "../webhook-events/ingest-tradingview-payload.js";
import type {
  MarketStateRepository,
  StoredMarketState
} from "./market-state-repository.js";

export type TradingViewMarketStateProjectionResult = {
  marketState: StoredMarketState;
};

export async function projectTradingViewMarketState(
  input: TradingViewIngestionResult,
  repository: MarketStateRepository
): Promise<TradingViewMarketStateProjectionResult> {
  const marketState = await repository.recordMarketState({
    marketKey: input.envelope.marketKey,
    webhookEventId: input.webhookEvent.id,
    tickerid: input.envelope.context.market.tickerid,
    timeframe: input.envelope.context.market.timeframe,
    barTimeMs: input.envelope.barTimeMs,
    context: input.envelope.context,
    createdAt: input.envelope.receivedAt
  });

  return { marketState };
}
