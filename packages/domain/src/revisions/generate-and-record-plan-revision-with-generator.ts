import { validatePlanRevision, type PlanRevision } from "@big-banana/contracts";
import type {
  AgentRunRepository,
  StoredAgentRun
} from "../agent-runs/agent-run-repository";
import type { JsonValue } from "../orders/order-repository";
import {
  buildPlannerInput,
  type PlannerInput,
  type PlannerInputBuildDependencies
} from "../planner/build-planner-input";
import type { StoredTradePlanVersion } from "../plans/trade-plan-version-repository";
import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload";
import type {
  PlanRevisionSuggestionRepository,
  StoredPlanRevisionSuggestion
} from "./plan-revision-suggestion-repository";
import type {
  PlannerRunnerInfo
} from "../planner/generate-and-record-trade-plan-with-generator";

export class MissingActivePlanForRevisionError extends Error {
  constructor() {
    super("Plan revision requires an active plan for the current market");
    this.name = "MissingActivePlanForRevisionError";
  }
}

export class InvalidGeneratedPlanRevisionError extends Error {
  constructor() {
    super("Generated plan revision does not satisfy the frozen schema");
    this.name = "InvalidGeneratedPlanRevisionError";
  }
}

export type GeneratedPlanRevisionResult = {
  planRevision: PlanRevision;
  tokenUsageJson?: JsonValue | null;
};

export type PlanRevisionGeneratorContext = {
  plannerInput: PlannerInput;
  activePlan: StoredTradePlanVersion;
};

export type PlanRevisionGenerator = (
  context: PlanRevisionGeneratorContext
) =>
  | Promise<PlanRevision | GeneratedPlanRevisionResult>
  | PlanRevision
  | GeneratedPlanRevisionResult;

export type GenerateAndRecordPlanRevisionWithGeneratorResult = {
  plannerInput: PlannerInput;
  activePlan: StoredTradePlanVersion;
  planRevision: PlanRevision;
  agentRun: StoredAgentRun;
  suggestion: StoredPlanRevisionSuggestion;
};

export async function generateAndRecordPlanRevisionWithGenerator(
  envelope: CanonicalEnvelope,
  plannerInputDependencies: PlannerInputBuildDependencies,
  planRevisionSuggestionRepository: PlanRevisionSuggestionRepository,
  agentRunRepository: AgentRunRepository,
  generator: PlanRevisionGenerator,
  runner: PlannerRunnerInfo,
  startedAt = new Date().toISOString()
): Promise<GenerateAndRecordPlanRevisionWithGeneratorResult> {
  const startedAtMs = Date.parse(startedAt);

  try {
    const plannerInput = await buildPlannerInput(
      envelope,
      plannerInputDependencies
    );
    const activePlan = plannerInput.state.activePlan;

    if (!activePlan) {
      throw new MissingActivePlanForRevisionError();
    }

    const generated = await generator({ plannerInput, activePlan });
    const generatedResult = normalizeGeneratedPlanRevisionResult(generated);
    const planRevision = generatedResult.planRevision;

    if (!validatePlanRevision(planRevision)) {
      throw new InvalidGeneratedPlanRevisionError();
    }

    const completedAt = new Date().toISOString();
    const agentRun = await agentRunRepository.recordAgentRun({
      marketKey: envelope.marketKey,
      sourceEventKey: envelope.eventKey,
      operation: "plan.revise",
      runnerKind: runner.runnerKind,
      modelProvider: runner.modelProvider,
      model: runner.model,
      skillName: runner.skillName,
      promptVersion: runner.promptVersion,
      status: "success",
      inputSummary: buildInputSummary(plannerInput, activePlan, envelope.marketKey),
      outputSummary: buildOutputSummary(planRevision, activePlan),
      tokenUsageJson: generatedResult.tokenUsageJson ?? null,
      executionEligible: null,
      tradePlanVersionId: activePlan.id,
      errorMessage: null,
      startedAt,
      completedAt,
      latencyMs: Math.max(0, Date.parse(completedAt) - startedAtMs)
    });

    const suggestion = await planRevisionSuggestionRepository.recordPlanRevisionSuggestion({
      planId: activePlan.planId,
      tradePlanVersionId: activePlan.id,
      marketKey: activePlan.marketKey,
      sourceEventKey: envelope.eventKey,
      revisionAction: planRevision.revision_action,
      reason: planRevision.reason,
      changedFields: planRevision.changed_fields,
      newInvalidation: planRevision.new_invalidation,
      newManagementRules: planRevision.new_management_rules,
      requiresUserReview: planRevision.requires_user_review,
      agentRunId: agentRun.id,
      createdAt: completedAt
    });

    return {
      plannerInput,
      activePlan,
      planRevision,
      agentRun,
      suggestion
    };
  } catch (error) {
    const completedAt = new Date().toISOString();

    await agentRunRepository.recordAgentRun({
      marketKey: envelope.marketKey,
      sourceEventKey: envelope.eventKey,
      operation: "plan.revise",
      runnerKind: runner.runnerKind,
      modelProvider: runner.modelProvider,
      model: runner.model,
      skillName: runner.skillName,
      promptVersion: runner.promptVersion,
      status:
        error instanceof InvalidGeneratedPlanRevisionError
          ? "invalid_output"
          : "failed",
      inputSummary: {
        market_key: envelope.marketKey,
        event_key: envelope.eventKey,
        signal: envelope.signal ?? null
      },
      outputSummary: null,
      tokenUsageJson: null,
      executionEligible: null,
      tradePlanVersionId: null,
      errorMessage: error instanceof Error ? error.message : "Unknown agent error",
      startedAt,
      completedAt,
      latencyMs: Math.max(0, Date.parse(completedAt) - startedAtMs)
    });

    throw error;
  }
}

function normalizeGeneratedPlanRevisionResult(
  value: PlanRevision | GeneratedPlanRevisionResult
): GeneratedPlanRevisionResult {
  if ("planRevision" in value) {
    return value;
  }

  return { planRevision: value };
}

function buildInputSummary(
  plannerInput: PlannerInput,
  activePlan: StoredTradePlanVersion,
  marketKey: string
): Record<string, JsonValue> {
  return {
    market_key: marketKey,
    signal: plannerInput.signal,
    active_plan: {
      plan_id: activePlan.planId,
      version: activePlan.version,
      action: activePlan.action,
      execution_state: activePlan.executionPlaybook.state
    },
    open_orders_count: plannerInput.state.openOrders.length,
    has_open_position: plannerInput.state.openPosition !== null,
    recent_snapshot_count: plannerInput.state.recentSnapshots.length,
    window_summary: {
      net_direction: plannerInput.state.windowSummary.netDirection,
      extension_from_ema20_atr:
        plannerInput.state.windowSummary.extensionFromEma20Atr
    }
  };
}

function buildOutputSummary(
  planRevision: PlanRevision,
  activePlan: StoredTradePlanVersion
): Record<string, JsonValue> {
  return {
    revision_action: planRevision.revision_action,
    changed_fields_count: planRevision.changed_fields.length,
    requires_user_review: planRevision.requires_user_review,
    active_plan_version_id: activePlan.id,
    active_plan_version: activePlan.version
  };
}
