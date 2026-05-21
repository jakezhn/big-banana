import type { MarketStateRepository } from "../market-state/market-state-repository";
import type { JsonValue } from "../orders/order-repository";
import type { TradePlanVersionRepository } from "../plans/trade-plan-version-repository";
import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload";
import type {
  AgentRunRepository,
  StoredAgentRun
} from "./agent-run-repository";
import {
  generateAndRecordTradePlanForSignal,
  InvalidGeneratedTradePlanError,
  type GenerateAndRecordTradePlanForSignalResult
} from "../planner/generate-and-record-trade-plan-for-signal";

export type GenerateAndRecordTradePlanWithAgentRunResult = {
  plan: GenerateAndRecordTradePlanForSignalResult;
  agentRun: StoredAgentRun;
};

export async function generateAndRecordTradePlanWithAgentRun(
  envelope: CanonicalEnvelope,
  marketStateRepository: MarketStateRepository,
  tradePlanVersionRepository: TradePlanVersionRepository,
  agentRunRepository: AgentRunRepository,
  startedAt = new Date().toISOString()
): Promise<GenerateAndRecordTradePlanWithAgentRunResult> {
  const startedAtMs = Date.parse(startedAt);

  try {
    const plan = await generateAndRecordTradePlanForSignal(
      envelope,
      marketStateRepository,
      tradePlanVersionRepository
    );
    const completedAt = new Date().toISOString();
    const agentRun = await agentRunRepository.recordAgentRun({
      marketKey: envelope.marketKey,
      sourceEventKey: envelope.eventKey,
      operation: "plan.generate",
      runnerKind: "deterministic",
      model: null,
      status: "success",
      inputSummary: buildInputSummary(plan),
      outputSummary: buildOutputSummary(plan),
      tradePlanVersionId: plan.recordResult.tradePlanVersion.id,
      errorMessage: null,
      startedAt,
      completedAt,
      latencyMs: Math.max(0, Date.parse(completedAt) - startedAtMs)
    });

    return { plan, agentRun };
  } catch (error) {
    const completedAt = new Date().toISOString();

    await agentRunRepository.recordAgentRun({
      marketKey: envelope.marketKey,
      sourceEventKey: envelope.eventKey,
      operation: "plan.generate",
      runnerKind: "deterministic",
      model: null,
      status:
        error instanceof InvalidGeneratedTradePlanError
          ? "invalid_output"
          : "failed",
      inputSummary: buildFailureInputSummary(envelope),
      outputSummary: null,
      tradePlanVersionId: null,
      errorMessage: error instanceof Error ? error.message : "Unknown agent error",
      startedAt,
      completedAt,
      latencyMs: Math.max(0, Date.parse(completedAt) - startedAtMs)
    });

    throw error;
  }
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
  plan: GenerateAndRecordTradePlanForSignalResult
): Record<string, JsonValue> {
  return {
    market_key: plan.recordResult.tradePlanVersion.marketKey,
    signal: plan.plannerInput.signal,
    snapshot_count: Object.keys(plan.plannerInput.state.latestSnapshots).length,
    open_orders_count: plan.plannerInput.state.openOrders.length,
    open_position: plan.plannerInput.state.openPosition ?? null
  };
}

function buildOutputSummary(
  plan: GenerateAndRecordTradePlanForSignalResult
): Record<string, JsonValue> {
  return {
    action: plan.tradePlan.action,
    bias: plan.tradePlan.market_thesis.bias,
    execution_state: plan.tradePlan.execution_playbook.state,
    risk_tier: plan.tradePlan.risk_intent.risk_tier,
    trade_plan_version_id: plan.recordResult.tradePlanVersion.id,
    plan_id: plan.recordResult.tradePlanVersion.planId,
    version: plan.recordResult.tradePlanVersion.version
  };
}
