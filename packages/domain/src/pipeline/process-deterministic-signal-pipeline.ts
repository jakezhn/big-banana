import type { AgentRunRepository } from "../agent-runs/agent-run-repository";
import type { MarketStateRepository } from "../market-state/market-state-repository";
import { type GenerateAndRecordTradePlanForSignalResult } from "../planner/generate-and-record-trade-plan-for-signal";
import { generateAndRecordTradePlanWithAgentRun } from "../agent-runs/generate-and-record-trade-plan-with-agent-run";
import {
  evaluateAndRecordDeterministicRiskVerdict,
  type RiskPolicySnapshot
} from "../risk/evaluate-deterministic-risk-verdict";
import type { RiskVerdictRepository } from "../risk/risk-verdict-repository";
import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload";
import {
  buildAndRecordExecutionIntentFromRiskVerdict,
} from "../execution/build-execution-intent-from-risk-verdict";
import type {
  ExecutionIntentRepository,
  StoredExecutionIntent
} from "../execution/execution-intent-repository";
import type { TradePlanVersionRepository } from "../plans/trade-plan-version-repository";
import type { StoredRiskVerdict } from "../risk/risk-verdict-repository";

export type ProcessDeterministicSignalPipelineResult = {
  plan: GenerateAndRecordTradePlanForSignalResult;
  riskVerdict: StoredRiskVerdict;
  executionIntent: StoredExecutionIntent | null;
};

export type ProcessDeterministicSignalPipelineDependencies = {
  marketStateRepository: MarketStateRepository;
  tradePlanVersionRepository: TradePlanVersionRepository;
  riskVerdictRepository: RiskVerdictRepository;
  executionIntentRepository: ExecutionIntentRepository;
  agentRunRepository: AgentRunRepository;
};

export async function processDeterministicSignalPipeline(
  envelope: CanonicalEnvelope,
  riskPolicy: RiskPolicySnapshot,
  dependencies: ProcessDeterministicSignalPipelineDependencies,
  createdAt = new Date().toISOString()
): Promise<ProcessDeterministicSignalPipelineResult> {
  const { plan } = await generateAndRecordTradePlanWithAgentRun(
    envelope,
    dependencies.marketStateRepository,
    dependencies.tradePlanVersionRepository,
    dependencies.agentRunRepository,
    createdAt
  );
  const riskVerdict = await evaluateAndRecordDeterministicRiskVerdict(
    plan.recordResult.tradePlanVersion,
    riskPolicy,
    dependencies.riskVerdictRepository,
    createdAt
  );
  const executionIntent = await maybeBuildAndRecordExecutionIntent(
    plan.recordResult.tradePlanVersion,
    riskVerdict,
    dependencies.executionIntentRepository,
    createdAt
  );

  return {
    plan,
    riskVerdict,
    executionIntent
  };
}

async function maybeBuildAndRecordExecutionIntent(
  tradePlanVersion: GenerateAndRecordTradePlanForSignalResult["recordResult"]["tradePlanVersion"],
  riskVerdict: StoredRiskVerdict,
  repository: ExecutionIntentRepository,
  createdAt: string
): Promise<StoredExecutionIntent | null> {
  if (
    riskVerdict.verdict !== "approve" &&
    riskVerdict.verdict !== "approve_with_reduction"
  ) {
    return null;
  }

  return buildAndRecordExecutionIntentFromRiskVerdict(
    tradePlanVersion,
    riskVerdict,
    repository,
    createdAt
  );
}
