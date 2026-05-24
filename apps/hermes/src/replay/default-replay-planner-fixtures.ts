import type { SignalWebhookPayloadV12 } from "@big-banana/contracts";
import type { ReplayPlannerFixture } from "./replay-planner-harness";

export const defaultReplayPlannerFixtures: ReplayPlannerFixture[] = [
  {
    fixtureId: "crypto-btc-4h-long",
    market: "crypto",
    symbol: "BINANCE:BTCUSDT",
    timeframe: "240",
    receivedAt: "2026-05-24T10:00:00.000Z",
    tags: ["crypto", "4h", "continuation"],
    notes: "Crypto 4H aligned long continuation fixture",
    rawPayload: buildSignalPayload({
      tickerid: "BINANCE:BTCUSDT",
      source: "BINANCE",
      timeframe: "240",
      timeframeLabel: "4h",
      barTimeMs: 1778404800000,
      direction: "long",
      rankLevel: 4,
      rankPct: 0.83,
      gain: 0.61,
      pain: 0.38,
      regime: "pullback",
      regimeAlignment: "align",
      klRole: "support",
      klSource: "EMA50",
      hasDivergence: true
    })
  },
  {
    fixtureId: "us-equity-aapl-1h-short",
    market: "us_equity",
    symbol: "NASDAQ:AAPL",
    timeframe: "60",
    receivedAt: "2026-05-24T10:05:00.000Z",
    tags: ["us_equity", "1h", "mean-revert"],
    notes: "US equity 1H short fixture",
    rawPayload: buildSignalPayload({
      tickerid: "NASDAQ:AAPL",
      source: "NASDAQ",
      timeframe: "60",
      timeframeLabel: "1h",
      barTimeMs: 1778408400000,
      direction: "short",
      rankLevel: 4,
      rankPct: 0.78,
      gain: 0.58,
      pain: 0.34,
      regime: "expansion",
      regimeAlignment: "align",
      klRole: "resistance",
      klSource: "relative_high",
      hasDivergence: false
    })
  },
  {
    fixtureId: "commodity-gold-1d-watch",
    market: "commodity",
    symbol: "OANDA:XAUUSD",
    timeframe: "1D",
    receivedAt: "2026-05-24T10:10:00.000Z",
    tags: ["commodity", "1d", "watch"],
    notes: "Commodity 1D lower-rank fixture expected to stay in watch/skip territory",
    rawPayload: buildSignalPayload({
      tickerid: "OANDA:XAUUSD",
      source: "OANDA",
      timeframe: "1D",
      timeframeLabel: "1d",
      barTimeMs: 1778491200000,
      direction: "long",
      rankLevel: 2,
      rankPct: 0.49,
      gain: 0.31,
      pain: 0.36,
      regime: "transition",
      regimeAlignment: "neutral",
      klRole: "support",
      klSource: "EMA100",
      hasDivergence: false
    })
  }
];

type BuildSignalPayloadInput = {
  tickerid: string;
  source: string;
  timeframe: string;
  timeframeLabel: string;
  barTimeMs: number;
  direction: "long" | "short";
  rankLevel: 1 | 2 | 3 | 4;
  rankPct: number;
  gain: number;
  pain: number;
  regime: "expansion" | "pullback" | "transition" | "neutral";
  regimeAlignment: "align" | "counter" | "neutral";
  klRole: "support" | "resistance" | "none";
  klSource: string;
  hasDivergence: boolean;
};

function buildSignalPayload(
  input: BuildSignalPayloadInput
): SignalWebhookPayloadV12 {
  const isLong = input.direction === "long";
  const basePrice = isLong ? 67000 : 225;
  const barOpen = isLong ? basePrice : basePrice + 2;
  const barClose = isLong ? basePrice + 4 : basePrice - 3;

  return {
    schema_version: "bitpunk.webhook.v12",
    type: "signal",
    context: {
      market: {
        tickerid: input.tickerid,
        source: input.source,
        timeframe: input.timeframe,
        timeframe_label: input.timeframeLabel
      },
      bar: {
        index: 12345,
        time_ms: input.barTimeMs,
        open: barOpen,
        high: Math.max(barOpen, barClose) + 5,
        low: Math.min(barOpen, barClose) - 5,
        close: barClose,
        volume: 12345.6
      },
      volatility: {
        atr: isLong ? 3.2 : 2.1,
        atr_len: 14
      },
      regime: {
        name: isLong ? "Bull Pullback" : "Bear Expansion",
        trend_score: isLong ? 5.8 : 5.1
      },
      structure: {
        ema20: isLong ? barClose - 1 : barClose + 1,
        ema50: isLong ? barClose - 3 : barClose + 3,
        ema100: isLong ? barClose - 6 : barClose + 6,
        ema200: isLong ? barClose - 10 : barClose + 10,
        relative_high: Math.max(barOpen, barClose) + 12,
        relative_low: Math.min(barOpen, barClose) - 12
      },
      momentum: {
        value: isLong ? 18.2 : -16.4,
        direction: isLong ? "bull" : "bear",
        sqz: "off"
      },
      osc: {
        fast: isLong ? 54.1 : 42.4,
        slow: isLong ? 48.6 : 49.9,
        spread: isLong ? 5.5 : -7.5,
        direction: isLong ? "bull" : "bear"
      }
    },
    signal: {
      direction: input.direction,
      rank_level: input.rankLevel,
      rank_pct: input.rankPct,
      regime: input.regime,
      regime_alignement: input.regimeAlignment,
      kl: {
        has_kl: input.klRole !== "none",
        role: input.klRole,
        source: input.klSource
      },
      divergence: {
        has_divergence: input.hasDivergence
      },
      gain: input.gain,
      pain: input.pain,
      proposed_size: 0.72
    }
  };
}
