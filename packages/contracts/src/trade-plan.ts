import { readFileSync } from "node:fs";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

export const tradePlanSchemaVersion =
  "https://bitpunk.local/schemas/trade-plan.schema.json" as const;

export type TradePlan = {
  action: "create" | "keep" | "patch" | "terminate" | "skip";
  market_thesis: {
    bias: "long" | "short" | "neutral";
    environment: "trend" | "range" | "transition" | "exhaustion";
    htf_bias: "bull" | "bear" | "neutral";
    mtf_bias: "bull" | "bear" | "neutral";
    bias_confidence: number;
    trend_end_score: number;
    structure_summary: string;
    key_levels: Array<{
      role: "support" | "resistance";
      price_ref: "EMA50" | "EMA100" | "EMA200" | "relative_high" | "relative_low";
      importance: "primary" | "secondary";
    }>;
  };
  execution_playbook: {
    state:
      | "watch"
      | "armed"
      | "pending_entry"
      | "entered"
      | "managing"
      | "exit_only"
      | "closed"
      | "invalidated"
      | "expired";
    entry_style: "pullback" | "breakout_retest" | "range_edge" | "probe";
    entry_zone: {
      low: number | null;
      high: number | null;
      source: "structure" | "atr_band" | "exec_tf_setup";
    };
    allowed_triggers: Array<
      "aligned_signal" | "zone_touch" | "break_retest" | "counter_signal_for_trim"
    >;
    requires_signal: boolean;
    disqualifiers: string[];
    tp_style: "ladder" | "dynamic_trail" | "range_mean_revert";
    update_policy: "minor_patch" | "major_patch" | "replace_only";
  };
  risk_intent: {
    risk_tier: "probe" | "starter" | "standard" | "high_conviction";
    suggested_max_account_risk_pct: number;
    stop_anchor: "swing_low" | "swing_high" | "key_level_break" | "range_edge_break";
    stop_buffer_atr: number;
    rationale_codes: string[];
  };
  reasoning_summary: string;
  evidence: string[];
};

const schemaUrl = new URL(
  "../../../docs/development/schemas/trade-plan.schema.json",
  import.meta.url
);
const schema = JSON.parse(readFileSync(schemaUrl, "utf8")) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile<TradePlan>(schema);

export function validateTradePlan(payload: unknown): payload is TradePlan {
  return validate(payload);
}

export function getTradePlanValidationErrors(): ErrorObject[] {
  return validate.errors ?? [];
}
