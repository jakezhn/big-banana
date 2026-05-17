import type { StoredExecutionIntent } from "../execution/execution-intent-repository.js";
import type { StoredMarketState } from "../market-state/market-state-repository.js";
import type { StoredTradePlanVersion } from "../plans/trade-plan-version-repository.js";
import type { StoredRiskVerdict } from "../risk/risk-verdict-repository.js";

export type MarketPipelineReadModel = {
  marketKey: string;
  marketState: StoredMarketState | null;
  tradePlanVersion: StoredTradePlanVersion | null;
  riskVerdict: StoredRiskVerdict | null;
  executionIntent: StoredExecutionIntent | null;
};

export interface MarketPipelineReadModelRepository {
  getLatestMarketPipeline(
    marketKey: string
  ): Promise<MarketPipelineReadModel | null>;
}
