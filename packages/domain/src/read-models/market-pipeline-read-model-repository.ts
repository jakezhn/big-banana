import type { StoredFill } from "../fills/fill-repository";
import type { StoredExecutionIntent } from "../execution/execution-intent-repository";
import type { StoredMarketState } from "../market-state/market-state-repository";
import type { StoredOrder } from "../orders/order-repository";
import type { StoredTradePlanVersion } from "../plans/trade-plan-version-repository";
import type { StoredPositionSnapshot } from "../positions/position-repository";
import type { StoredPostPlanReview } from "../reviews/post-plan-review-repository";
import type { StoredPlanRevisionSuggestion } from "../revisions/plan-revision-suggestion-repository";
import type { StoredRiskVerdict } from "../risk/risk-verdict-repository";
import type { StoredMemoryLessonCandidate } from "../memory/memory-lesson-candidate-repository";

export type MarketPipelineReadModel = {
  marketKey: string;
  marketState: StoredMarketState | null;
  tradePlanVersion: StoredTradePlanVersion | null;
  latestPlanRevisionSuggestion: StoredPlanRevisionSuggestion | null;
  latestPostPlanReview: StoredPostPlanReview | null;
  memoryLessonCandidates: StoredMemoryLessonCandidate[];
  riskVerdict: StoredRiskVerdict | null;
  executionIntent: StoredExecutionIntent | null;
  latestOrder: StoredOrder | null;
  latestFill: StoredFill | null;
  currentPosition: StoredPositionSnapshot | null;
};

export interface MarketPipelineReadModelRepository {
  getLatestMarketPipeline(
    marketKey: string
  ): Promise<MarketPipelineReadModel | null>;
}
