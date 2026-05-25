import type { PlanRevision } from "@big-banana/contracts";
import type { PlannerInput } from "../planner/build-planner-input";
import type { StoredTradePlanVersion } from "../plans/trade-plan-version-repository";

export function generateDeterministicPlanRevision(
  plannerInput: PlannerInput,
  activePlan: StoredTradePlanVersion
): PlanRevision {
  const sameDirection =
    activePlan.marketThesis.bias !== "neutral" &&
    plannerInput.signal.direction === activePlan.marketThesis.bias;
  const tradableSignal =
    plannerInput.signal.regimeAlignment === "align" &&
    plannerInput.signal.rankLevel >= 3 &&
    plannerInput.signal.gain > plannerInput.signal.pain;
  const activeState = activePlan.executionPlaybook.state;
  const openPosition = plannerInput.state.openPosition;
  const extensionFromEma20Atr =
    plannerInput.state.windowSummary.extensionFromEma20Atr ?? 0;
  const latestVsAverageRangeRatio =
    plannerInput.state.windowSummary.latestVsAverageRangeRatio ?? 0;
  const overExtended =
    extensionFromEma20Atr >= 1.2 || latestVsAverageRangeRatio >= 1.35;

  if (
    activePlan.marketThesis.bias !== "neutral" &&
    plannerInput.signal.regimeAlignment !== "neutral" &&
    !sameDirection
  ) {
    const action = openPosition ? "close_full" : "invalidate";

    return {
      revision_action: action,
      reason:
        "The latest signal now conflicts with the active plan bias, so the setup should no longer stay live in its current form.",
      changed_fields: [
        "market_thesis.bias",
        "execution_playbook.state",
        "reasoning_summary"
      ],
      new_invalidation: {
        condition:
          "The incoming signal direction now contradicts the active plan bias.",
        level_reference: null,
        timeframe: plannerInput.context.market.timeframe
      },
      new_management_rules: openPosition
        ? ["Close the existing position if deterministic risk and execution guardrails permit."]
        : ["Do not arm fresh entries until a new aligned signal appears."],
      requires_user_review: openPosition !== null
    };
  }

  if (!tradableSignal && (activeState === "armed" || activeState === "pending_entry")) {
    return {
      revision_action: "downgrade_to_watch",
      reason:
        "The latest signal no longer supports an executable setup, so the active plan should step back into watch mode.",
      changed_fields: [
        "execution_playbook.state",
        "execution_playbook.allowed_triggers",
        "risk_intent.risk_tier"
      ],
      new_invalidation: {
        condition:
          "A fresh aligned signal is required before the setup can be re-armed.",
        level_reference: activePlan.marketThesis.key_levels[0]?.price_ref ?? null,
        timeframe: plannerInput.context.market.timeframe
      },
      new_management_rules: [
        "Do not arm new entries until alignment, reward profile, and trigger quality improve."
      ],
      requires_user_review: false
    };
  }

  if (tradableSignal && sameDirection && activeState === "watch") {
    return {
      revision_action: "upgrade",
      reason:
        "The latest aligned signal improves the setup quality enough to promote the plan back toward an executable state.",
      changed_fields: [
        "execution_playbook.state",
        "risk_intent.risk_tier",
        "reasoning_summary"
      ],
      new_invalidation: {
        condition:
          "If alignment disappears again before entry, the plan should fall back to watch.",
        level_reference: activePlan.marketThesis.key_levels[0]?.price_ref ?? null,
        timeframe: plannerInput.context.market.timeframe
      },
      new_management_rules: [
        "Re-check risk before accepting a fresh entry because the plan is being promoted from watch."
      ],
      requires_user_review: false
    };
  }

  if (
    sameDirection &&
    (activeState === "armed" || activeState === "pending_entry" || activeState === "managing") &&
    overExtended
  ) {
    return {
      revision_action: "tighten",
      reason:
        "The setup remains aligned, but near-term extension and range expansion argue for tighter risk control and more selective triggers.",
      changed_fields: [
        "risk_intent.stop_buffer_atr",
        "execution_playbook.allowed_triggers"
      ],
      new_invalidation: {
        condition:
          "If extension fails to cool off, avoid fresh chasing entries and tighten invalidation discipline.",
        level_reference: activePlan.marketThesis.key_levels[0]?.price_ref ?? null,
        timeframe: plannerInput.context.market.timeframe
      },
      new_management_rules: [
        "Tighten stop discipline while extension remains elevated.",
        "Require a cleaner pullback before adding or re-arming fresh entries."
      ],
      requires_user_review: openPosition !== null
    };
  }

  return {
    revision_action: "keep",
    reason:
      "The latest context does not materially change the active plan, so no revision is required.",
    changed_fields: [],
    new_invalidation: null,
    new_management_rules: [],
    requires_user_review: false
  };
}
