import type { MarketStateRepository } from "../market-state/market-state-repository.js";
import {
  generateAndRecordTradePlanForSignal,
  type GenerateAndRecordTradePlanForSignalResult
} from "../planner/generate-and-record-trade-plan-for-signal.js";
import {
  evaluateAndRecordDeterministicRiskVerdict,
  type RiskPolicySnapshot
} from "../risk/evaluate-deterministic-risk-verdict.js";
import type { RiskVerdictRepository } from "../risk/risk-verdict-repository.js";
import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload.js";
import {
  buildAndRecordExecutionIntentFromRiskVerdict,
} from "../execution/build-execution-intent-from-risk-verdict.js";
import type {
  ExecutionIntentRepository,
  StoredExecutionIntent
} from "../execution/execution-intent-repository.js";
import type { TradePlanVersionRepository } from "../plans/trade-plan-version-repository.js";
import type { StoredRiskVerdict } from "../risk/risk-verdict-repository.js";

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
  if (riskVerdict.requireHumanApproval) {
    return null;
  }

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
