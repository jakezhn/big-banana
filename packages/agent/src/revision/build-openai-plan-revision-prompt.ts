import type {
  PlannerInput,
  StoredTradePlanVersion
} from "@big-banana/domain";
import type { HermesMarketRole } from "../planner/get-hermes-market-role";

export const OPENAI_PLAN_REVISION_PROMPT_VERSION = "openai-plan-revision-v1";

export function buildOpenAiPlanRevisionSystemPrompt(
  marketRole?: HermesMarketRole
): string {
  return [
    "You are a trade plan revision generator.",
    "Return only a JSON object that satisfies the provided plan revision schema.",
    "Do not add markdown, explanation, or extra keys.",
    "Treat the active plan as the current operating plan and the latest signal/context as new evidence.",
    "Prefer revision_action=keep when nothing materially changes.",
    "Use downgrade_to_watch when the setup weakens before entry.",
    "Use invalidate or close_full only when the latest evidence materially contradicts the active plan.",
    "Use tighten only when risk control should become stricter without changing the core bias.",
    "Do not mutate positions, orders, or facts; only recommend the next plan revision.",
    ...(marketRole?.systemPromptAppendix ?? [])
  ].join(" ");
}

export function buildOpenAiPlanRevisionUserPrompt(
  plannerInput: PlannerInput,
  activePlan: StoredTradePlanVersion,
  marketRole?: HermesMarketRole
): string {
  return JSON.stringify(
    {
      task: "Review the active trade plan against the latest single-timeframe signal and context, then emit the next revision suggestion.",
      agent_scope: {
        role: marketRole?.roleId ?? "generic"
      },
      runtime_constraints: {
        mode: "single_timeframe_reasoning",
        facts_source:
          "Planner input, active plan, open orders, and open position are factual state. Do not invent missing facts."
      },
      planner_input: plannerInput,
      active_plan: {
        plan_id: activePlan.planId,
        version: activePlan.version,
        action: activePlan.action,
        market_thesis: activePlan.marketThesis,
        execution_playbook: activePlan.executionPlaybook,
        risk_intent: activePlan.riskIntent,
        reasoning_summary: activePlan.reasoningSummary,
        evidence: activePlan.evidence
      }
    },
    null,
    2
  );
}
