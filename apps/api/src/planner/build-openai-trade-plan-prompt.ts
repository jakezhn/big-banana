import type { PlannerInput, StoredTradePlanVersion } from "@big-banana/domain";

export function buildOpenAiTradePlanSystemPrompt(): string {
  return [
    "You are a trading plan generator.",
    "Return only a JSON object that satisfies the provided trade plan schema.",
    "Do not add markdown, explanation, or extra keys.",
    "Be concise, conservative, and execution-aware.",
    "Use action=skip with execution_playbook.state=watch when the setup is not tradable.",
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
