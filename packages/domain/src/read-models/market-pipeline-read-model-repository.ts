import type { StoredExecutionIntent } from "../execution/execution-intent-repository";
import type { StoredMarketState } from "../market-state/market-state-repository";
import type { StoredOrder } from "../orders/order-repository";
import type { StoredTradePlanVersion } from "../plans/trade-plan-version-repository";
import type { StoredRiskVerdict } from "../risk/risk-verdict-repository";

export type MarketPipelineReadModel = {
  marketKey: string;
  marketState: StoredMarketState | null;
  tradePlanVersion: StoredTradePlanVersion | null;
  riskVerdict: StoredRiskVerdict | null;
  executionIntent: StoredExecutionIntent | null;
  latestOrder: StoredOrder | null;
};

export interface MarketPipelineReadModelRepository {
  getLatestMarketPipeline(
    marketKey: string
  ): Promise<MarketPipelineReadModel | null>;
}
