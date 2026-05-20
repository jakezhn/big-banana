import type { TradePlan } from "@big-banana/contracts";
import type { StoredTradePlanVersion } from "../plans/trade-plan-version-repository";
import type { PlannerInput } from "./build-planner-input";

export function generateDeterministicTradePlan(
  input: PlannerInput,
  activePlan?: StoredTradePlanVersion | null
): TradePlan {
  const shouldSkip =
    input.signal.regimeAlignment !== "align" ||
    input.signal.rankLevel <= 2 ||
    input.signal.gain <= input.signal.pain;

  if (shouldSkip) {
    return {
      action: activePlan ? "keep" : "skip",
      market_thesis: {
        bias: "neutral",
        environment: inferEnvironment(input),
        htf_bias: inferBias(input.context.momentum.direction),
        mtf_bias: inferBias(input.context.osc.direction),
        bias_confidence: clamp(input.signal.rankPct * 0.5),
        trend_end_score: clamp(
          input.signal.divergence.hasDivergence ? 0.7 : 0.45
        ),
        structure_summary:
          "Signal is not aligned enough with the current market state.",
        key_levels: []
      },
      execution_playbook: {
        state: "watch",
        entry_style: "probe",
        entry_zone: {
          low: null,
          high: null,
          source: "structure"
        },
        allowed_triggers: [],
        requires_signal: true,
        disqualifiers: [
          "signal_not_aligned",
          input.signal.gain <= input.signal.pain
            ? "insufficient_reward_profile"
            : "low_signal_rank"
        ],
        tp_style: "range_mean_revert",
        update_policy: "replace_only"
      },
      risk_intent: {
        risk_tier: "probe",
        suggested_max_account_risk_pct: 0,
        stop_anchor: input.signal.direction === "long" ? "swing_low" : "swing_high",
        stop_buffer_atr: 0,
        rationale_codes: ["NO_TRADE"]
      },
      reasoning_summary:
        "The signal does not justify a tradable setup, so the plan remains in watch mode.",
      evidence: [
        `signal_alignment:${input.signal.regimeAlignment}`,
        `rank_level:${input.signal.rankLevel}`,
        `gain_vs_pain:${input.signal.gain.toFixed(2)}:${input.signal.pain.toFixed(2)}`
      ]
    };
  }

  const action = activePlan ? "patch" : "create";

  return {
    action,
    market_thesis: {
      bias: input.signal.direction,
      environment: inferEnvironment(input),
      htf_bias: inferBias(input.context.momentum.direction),
      mtf_bias: inferBias(input.context.osc.direction),
      bias_confidence: clamp(
        input.signal.rankPct +
          (input.signal.kl.hasKl ? 0.08 : 0) -
          (input.signal.divergence.hasDivergence ? 0.05 : 0)
      ),
      trend_end_score: clamp(
        (input.signal.divergence.hasDivergence ? 0.35 : 0.1) +
          (input.signal.regimeAlignment === "counter" ? 0.25 : 0)
      ),
      structure_summary:
        input.signal.direction === "long"
          ? "Bullish structure remains intact and the signal is aligned with support."
          : "Bearish structure remains intact and the signal is aligned with resistance.",
      key_levels: input.signal.kl.hasKl
        ? [
            {
              role: input.signal.kl.role === "support" ? "support" : "resistance",
              price_ref: normalizePriceRef(input.signal.kl.source),
              importance: "primary"
            }
          ]
        : []
    },
    execution_playbook: {
      state: "armed",
      entry_style: inferEntryStyle(input),
      entry_zone: buildEntryZone(input),
      allowed_triggers: ["aligned_signal", "zone_touch"],
      requires_signal: true,
      disqualifiers: ["htf_reversal", "loss_of_structure"],
      tp_style: inferEnvironment(input) === "range" ? "range_mean_revert" : "ladder",
      update_policy: action === "patch" ? "minor_patch" : "replace_only"
    },
    risk_intent: {
      risk_tier: inferRiskTier(input),
      suggested_max_account_risk_pct: inferRiskPct(input),
      stop_anchor: input.signal.direction === "long" ? "swing_low" : "swing_high",
      stop_buffer_atr: input.signal.rankLevel >= 4 ? 0.4 : 0.25,
      rationale_codes: ["ALIGNED_SIGNAL", `RANK_${input.signal.rankLevel}`]
    },
    reasoning_summary:
      "The signal is aligned with the current market structure and produces a tradable plan.",
    evidence: [
      `signal_alignment:${input.signal.regimeAlignment}`,
      `rank_level:${input.signal.rankLevel}`,
      `key_level:${input.signal.kl.source}`
    ]
  };
}

function inferEnvironment(input: PlannerInput): TradePlan["market_thesis"]["environment"] {
  const name = input.context.regime.name.toLowerCase();

  if (name.includes("range")) {
    return "range";
  }

  if (name.includes("transition")) {
    return "transition";
  }

  if (input.signal.divergence.hasDivergence && input.context.regime.trend_score < 4) {
    return "exhaustion";
  }

  return "trend";
}

function inferBias(direction: string): TradePlan["market_thesis"]["htf_bias"] {
  if (direction === "bull") {
    return "bull";
  }

  if (direction === "bear") {
    return "bear";
  }

  return "neutral";
}

function inferEntryStyle(
  input: PlannerInput
): TradePlan["execution_playbook"]["entry_style"] {
  if (inferEnvironment(input) === "range") {
    return "range_edge";
  }

  if (input.signal.regime === "pullback") {
    return "pullback";
  }

  return "breakout_retest";
}

function inferRiskTier(input: PlannerInput): TradePlan["risk_intent"]["risk_tier"] {
  if (input.signal.rankLevel >= 4 && input.signal.gain > input.signal.pain * 1.5) {
    return "standard";
  }

  if (input.signal.rankLevel >= 3) {
    return "starter";
  }

  return "probe";
}

function inferRiskPct(input: PlannerInput): number {
  if (input.signal.rankLevel >= 4 && input.signal.gain > input.signal.pain * 1.5) {
    return 1;
  }

  if (input.signal.rankLevel >= 3) {
    return 0.75;
  }

  return 0.5;
}

function buildEntryZone(
  input: PlannerInput
): TradePlan["execution_playbook"]["entry_zone"] {
  const atrBand = input.context.volatility.atr * 0.25;
  const ema50 = input.context.structure.ema50;

  return {
    low: Number((ema50 - atrBand).toFixed(2)),
    high: Number((ema50 + atrBand).toFixed(2)),
    source: input.signal.kl.hasKl ? "structure" : "atr_band"
  };
}

function normalizePriceRef(
  source: string
): TradePlan["market_thesis"]["key_levels"][number]["price_ref"] {
  if (source === "EMA100" || source === "EMA200") {
    return source;
  }

  if (source === "relative_high" || source === "relative_low") {
    return source;
  }

  return "EMA50";
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}
