import type { PlannerInput, StoredTradePlanVersion } from "@big-banana/domain";

export function buildOpenAiTradePlanSystemPrompt(): string {
  return [
    "You are a trading plan generator.",
    "Return only a JSON object that satisfies the provided trade plan schema.",
    "Do not add markdown, explanation, or extra keys.",
    "Be concise, conservative, and execution-aware.",
    "Use action=skip with execution_playbook.state=watch when the setup is not tradable.",
    "When action=create or action=patch for a live entry candidate, execution_playbook.state must be armed or pending_entry, not watch.",
    "Use execution_playbook.state=watch only for non-executable observation states, typically with action=skip or action=keep.",
    "If the market is bullish or bearish but confirmation is still missing, prefer action=skip over action=create with state=watch.",
    "Use recentSnapshots and windowSummary to reason about short-horizon trend continuity, pullback depth, extension versus EMA/ATR, structure quality, and trigger readiness.",
    "Respect activePlan, openPosition, and openOrders as current execution context rather than assuming a fresh flat book.",
    "Do not choose quantities, leverage, or final notional sizing beyond the schema."
  ].join(" ");
}

export function buildOpenAiTradePlanUserPrompt(
  plannerInput: PlannerInput,
  reusablePlan: StoredTradePlanVersion | null
): string {
  return JSON.stringify(
    {
      task: "Generate the next trade plan version for this market.",
      runtime_constraints: {
        pipeline_mode: "full",
        execution_rule:
          "create/patch plans are expected to be execution-capable and should use state=armed or state=pending_entry; otherwise choose skip/watch."
      },
      planner_input: plannerInput,
      active_plan: reusablePlan
        ? {
            plan_id: reusablePlan.planId,
            version: reusablePlan.version,
            action: reusablePlan.action,
            market_thesis: reusablePlan.marketThesis,
            execution_playbook: reusablePlan.executionPlaybook,
            risk_intent: reusablePlan.riskIntent,
            reasoning_summary: reusablePlan.reasoningSummary,
            evidence: reusablePlan.evidence
          }
        : null
    },
    null,
    2
  );
}
