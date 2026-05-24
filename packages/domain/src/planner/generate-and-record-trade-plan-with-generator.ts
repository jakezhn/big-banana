import { validateTradePlan, type TradePlan } from "@big-banana/contracts";
import type {
  AgentRunRepository,
  StoredAgentRun
} from "../agent-runs/agent-run-repository";
import type { JsonValue } from "../orders/order-repository";
import {
  recordGeneratedTradePlan,
  type RecordGeneratedTradePlanResult
} from "../plans/record-generated-trade-plan";
import type {
  StoredTradePlanVersion,
  TradePlanVersionRepository
} from "../plans/trade-plan-version-repository";
import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload";
import {
  buildPlannerInput,
  type PlannerInput,
  type PlannerInputBuildDependencies
} from "./build-planner-input";

export class InvalidGeneratedTradePlanError extends Error {
  constructor() {
    super("Generated trade plan does not satisfy the frozen schema");
    this.name = "InvalidGeneratedTradePlanError";
  }
}

export type TradePlanGeneratorContext = {
  plannerInput: PlannerInput;
  reusablePlan: StoredTradePlanVersion | null;
};

export type TradePlanGenerator = (
  context: TradePlanGeneratorContext
) =>
  | Promise<TradePlan | GeneratedTradePlanResult>
  | TradePlan
  | GeneratedTradePlanResult;

export type PlannerRunnerInfo = {
  runnerKind: string;
  modelProvider: string | null;
  model: string | null;
  skillName: string;
  promptVersion: string | null;
};

export type GeneratedTradePlanResult = {
  tradePlan: TradePlan;
  tokenUsageJson?: JsonValue | null;
};

export type GenerateAndRecordTradePlanWithGeneratorResult = {
  plannerInput: PlannerInput;
  tradePlan: TradePlan;
  recordResult: RecordGeneratedTradePlanResult;
  agentRun: StoredAgentRun;
};

export async function generateAndRecordTradePlanWithGenerator(
  envelope: CanonicalEnvelope,
  plannerInputDependencies: PlannerInputBuildDependencies,
  tradePlanVersionRepository: TradePlanVersionRepository,
  agentRunRepository: AgentRunRepository,
  generator: TradePlanGenerator,
  runner: PlannerRunnerInfo,
  startedAt = new Date().toISOString()
): Promise<GenerateAndRecordTradePlanWithGeneratorResult> {
  const startedAtMs = Date.parse(startedAt);

  try {
    const plannerInput = await buildPlannerInput(
      envelope,
      plannerInputDependencies
    );
    const reusablePlan = plannerInput.state.activePlan;
    const generated = await generator({ plannerInput, reusablePlan });
    const generatedResult = normalizeGeneratedTradePlanResult(generated);
    const tradePlan = generatedResult.tradePlan;

    if (!validateTradePlan(tradePlan)) {
      throw new InvalidGeneratedTradePlanError();
    }

    const recordResult = await recordGeneratedTradePlan(
      {
        tradePlan,
        marketKey: envelope.marketKey,
        sourceEventKey: envelope.eventKey,
        planId: reusablePlan?.planId
      },
      tradePlanVersionRepository
    );
    const completedAt = new Date().toISOString();

    const agentRun = await agentRunRepository.recordAgentRun({
      marketKey: envelope.marketKey,
      sourceEventKey: envelope.eventKey,
      operation: "plan.generate",
      runnerKind: runner.runnerKind,
      modelProvider: runner.modelProvider,
      model: runner.model,
      skillName: runner.skillName,
      promptVersion: runner.promptVersion,
      status: "success",
      inputSummary: buildInputSummary(plannerInput, recordResult.tradePlanVersion.marketKey),
      outputSummary: buildOutputSummary(tradePlan, recordResult),
      tokenUsageJson: generatedResult.tokenUsageJson ?? null,
      executionEligible: isExecutionEligibleTradePlan(tradePlan),
      tradePlanVersionId: recordResult.tradePlanVersion.id,
      errorMessage: null,
      startedAt,
      completedAt,
      latencyMs: Math.max(0, Date.parse(completedAt) - startedAtMs)
    });

    return {
      plannerInput,
      tradePlan,
      recordResult,
      agentRun
    };
  } catch (error) {
    const completedAt = new Date().toISOString();

    await agentRunRepository.recordAgentRun({
      marketKey: envelope.marketKey,
      sourceEventKey: envelope.eventKey,
      operation: "plan.generate",
      runnerKind: runner.runnerKind,
      modelProvider: runner.modelProvider,
      model: runner.model,
      skillName: runner.skillName,
      promptVersion: runner.promptVersion,
      status:
        error instanceof InvalidGeneratedTradePlanError
          ? "invalid_output"
          : "failed",
      inputSummary: buildFailureInputSummary(envelope),
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

function normalizeGeneratedTradePlanResult(
  value: TradePlan | GeneratedTradePlanResult
): GeneratedTradePlanResult {
  if ("tradePlan" in value) {
    return value;
  }

  return { tradePlan: value };
}

function isExecutionEligibleTradePlan(tradePlan: TradePlan): boolean {
  const executionState = tradePlan.execution_playbook.state;

  return (
    (tradePlan.action === "create" || tradePlan.action === "patch") &&
    (executionState === "armed" || executionState === "pending_entry")
  );
}

function buildFailureInputSummary(
  envelope: CanonicalEnvelope
): Record<string, JsonValue> {
  return {
    market_key: envelope.marketKey,
    event_key: envelope.eventKey,
    signal: envelope.signal ?? null
  };
}

function buildInputSummary(
  plannerInput: PlannerInput,
  marketKey: string
): Record<string, JsonValue> {
  return {
    market_key: marketKey,
    signal: plannerInput.signal,
    snapshot_count: Object.keys(plannerInput.state.latestSnapshots).length,
    recent_snapshot_count: plannerInput.state.recentSnapshots.length,
    window_summary: {
      net_direction: plannerInput.state.windowSummary.netDirection,
      close_change_pct: plannerInput.state.windowSummary.closeChangePct
    },
    has_active_plan: plannerInput.state.activePlan !== null,
    open_orders_count: plannerInput.state.openOrders.length,
    open_position: plannerInput.state.openPosition ?? null
  };
}

function buildOutputSummary(
  tradePlan: TradePlan,
  recordResult: RecordGeneratedTradePlanResult
): Record<string, JsonValue> {
  return {
    action: tradePlan.action,
    bias: tradePlan.market_thesis.bias,
    execution_state: tradePlan.execution_playbook.state,
    risk_tier: tradePlan.risk_intent.risk_tier,
    trade_plan_version_id: recordResult.tradePlanVersion.id,
    plan_id: recordResult.tradePlanVersion.planId,
    version: recordResult.tradePlanVersion.version
  };
}
