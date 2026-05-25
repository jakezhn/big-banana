import type {
  MemoryLessonCandidates,
  MemoryLessonCandidateItem
} from "@big-banana/contracts";
import type { MarketPipelineReadModel } from "../read-models/market-pipeline-read-model-repository";
import type { StoredPostPlanReview } from "../reviews/post-plan-review-repository";

export function generateDeterministicMemoryLessonCandidates(
  review: StoredPostPlanReview,
  pipeline: MarketPipelineReadModel
): MemoryLessonCandidates {
  const marketState = pipeline.marketState;
  const plan = pipeline.tradePlanVersion;

  if (review.lessonCandidates.length === 0 || !plan) {
    return {
      memory_items: [],
      reject_reasons:
        review.lessonCandidates.length === 0
          ? ["no_lesson_candidates"]
          : ["missing_trade_plan_context"]
    };
  }

  const market = inferScopeMarketFromMarketKey(review.marketKey);
  const assetClass = inferAssetClass(market, review.marketKey);
  const timeframe = marketState?.timeframe ?? extractTimeframeFromMarketKey(review.marketKey);
  const regime = plan.marketThesis.environment;
  const signalType = plan.executionPlaybook.entry_style;

  return {
    memory_items: review.lessonCandidates.map((lesson): MemoryLessonCandidateItem => ({
      lesson,
      scope: {
        market,
        asset_class: assetClass,
        symbol: marketState?.tickerid ?? extractSymbolFromMarketKey(review.marketKey),
        timeframe,
        regime,
        signal_type: signalType
      },
      confidence: review.shouldUpdateStrategyMemory ? 0.58 : 0.35,
      sample_size: 1,
      decay_days: 90,
      retrieval_hint: [
        market,
        timeframe,
        signalType,
        regime,
        review.marketKey
      ]
        .filter((token): token is string => Boolean(token))
        .join(" ")
    })),
    reject_reasons: []
  };
}

function inferScopeMarketFromMarketKey(marketKey: string): string {
  if (
    marketKey.startsWith("BINANCE:") ||
    marketKey.startsWith("BYBIT:") ||
    marketKey.startsWith("OKX:")
  ) {
    return "crypto";
  }

  if (marketKey.startsWith("NASDAQ:") || marketKey.startsWith("NYSE:")) {
    return "us_equity";
  }

  if (
    marketKey.startsWith("SSE:") ||
    marketKey.startsWith("SZSE:") ||
    marketKey.startsWith("HKEX:")
  ) {
    return "cn_equity";
  }

  if (marketKey.startsWith("OANDA:") || marketKey.includes("XAU") || marketKey.includes("OIL")) {
    return "commodity";
  }

  return "unknown";
}

function inferAssetClass(market: string, marketKey: string): string | null {
  if (market === "crypto") {
    return marketKey.includes("BTC") || marketKey.includes("ETH")
      ? "large_cap_crypto"
      : "crypto";
  }

  if (market === "commodity") {
    if (marketKey.includes("XAU") || marketKey.includes("GOLD")) {
      return "gold";
    }

    if (marketKey.includes("OIL")) {
      return "energy";
    }

    return "commodity";
  }

  return null;
}

function extractSymbolFromMarketKey(marketKey: string): string | null {
  const [symbol] = marketKey.split(/:(?=[^:]+$)/);
  return symbol ?? null;
}

function extractTimeframeFromMarketKey(marketKey: string): string | null {
  const parts = marketKey.split(":");
  return parts.at(-1) ?? null;
}
