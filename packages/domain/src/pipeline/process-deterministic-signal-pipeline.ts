import type { MarketStateRepository } from "../market-state/market-state-repository";
import {
  generateAndRecordTradePlanForSignal,
  type GenerateAndRecordTradePlanForSignalResult
} from "../planner/generate-and-record-trade-plan-for-signal";
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
};

export async function processDeterministicSignalPipeline(
  envelope: CanonicalEnvelope,
  riskPolicy: RiskPolicySnapshot,
  dependencies: ProcessDeterministicSignalPipelineDependencies,
  createdAt = new Date().toISOString()
): Promise<ProcessDeterministicSignalPipelineResult> {
  const plan = await generateAndRecordTradePlanForSignal(
    envelope,
    dependencies.marketStateRepository,
    dependencies.tradePlanVersionRepository
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
