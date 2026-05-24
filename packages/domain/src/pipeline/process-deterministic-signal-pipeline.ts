import type { AgentRunRepository } from "../agent-runs/agent-run-repository";
import type { MarketStateRepository } from "../market-state/market-state-repository";
import type { OrderRepository } from "../orders/order-repository";
import { type GenerateAndRecordTradePlanForSignalResult } from "../planner/generate-and-record-trade-plan-for-signal";
import { generateDeterministicTradePlan } from "../planner/generate-deterministic-trade-plan";
import {
  generateAndRecordTradePlanWithGenerator,
  type GenerateAndRecordTradePlanWithGeneratorResult,
  type PlannerRunnerInfo,
  type TradePlanGenerator
} from "../planner/generate-and-record-trade-plan-with-generator";
import {
  evaluateAndRecordDeterministicRiskVerdict,
  type RiskPolicySnapshot
} from "../risk/evaluate-deterministic-risk-verdict";
import type { RiskVerdictRepository } from "../risk/risk-verdict-repository";
import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload";
import {
  buildAndRecordExecutionIntentFromRiskVerdict,
  UnsupportedExecutionIntentError,
} from "../execution/build-execution-intent-from-risk-verdict";
import type {
  ExecutionIntentRepository,
  StoredExecutionIntent
} from "../execution/execution-intent-repository";
import type { TradePlanVersionRepository } from "../plans/trade-plan-version-repository";
import type { PositionRepository } from "../positions/position-repository";
import type { StoredRiskVerdict } from "../risk/risk-verdict-repository";

export type ProcessDeterministicSignalPipelineResult = {
  plan: GenerateAndRecordTradePlanForSignalResult;
  riskVerdict: StoredRiskVerdict;
  executionIntent: StoredExecutionIntent | null;
};

export type ProcessDeterministicSignalPipelineDependencies = {
  marketStateRepository: MarketStateRepository;
  tradePlanVersionRepository: TradePlanVersionRepository;
  orderRepository: OrderRepository;
  positionRepository: PositionRepository;
  tradingAccountId: string;
  riskVerdictRepository: RiskVerdictRepository;
  executionIntentRepository: ExecutionIntentRepository;
  agentRunRepository: AgentRunRepository;
};

export type ProcessSignalPipelineWithGeneratorDependencies =
  ProcessDeterministicSignalPipelineDependencies;

export async function processDeterministicSignalPipeline(
  envelope: CanonicalEnvelope,
  riskPolicy: RiskPolicySnapshot,
  dependencies: ProcessDeterministicSignalPipelineDependencies,
  createdAt = new Date().toISOString()
): Promise<ProcessDeterministicSignalPipelineResult> {
  return processSignalPipelineWithGenerator(
    envelope,
    riskPolicy,
    dependencies,
    ({ plannerInput, reusablePlan }) =>
      generateDeterministicTradePlan(plannerInput, reusablePlan),
    {
      runnerKind: "deterministic",
      model: null
    },
    createdAt
  );
}

export async function processSignalPipelineWithGenerator(
  envelope: CanonicalEnvelope,
  riskPolicy: RiskPolicySnapshot,
  dependencies: ProcessSignalPipelineWithGeneratorDependencies,
  generator: TradePlanGenerator,
  runner: PlannerRunnerInfo,
  createdAt = new Date().toISOString()
): Promise<ProcessDeterministicSignalPipelineResult> {
  const plan =
    await generateAndRecordTradePlanWithGenerator(
      envelope,
      {
        marketStateRepository: dependencies.marketStateRepository,
        tradePlanVersionRepository: dependencies.tradePlanVersionRepository,
        orderRepository: dependencies.orderRepository,
        positionRepository: dependencies.positionRepository,
        tradingAccountId: dependencies.tradingAccountId
      },
      dependencies.tradePlanVersionRepository,
      dependencies.agentRunRepository,
      generator,
      runner,
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

  try {
    return await buildAndRecordExecutionIntentFromRiskVerdict(
      tradePlanVersion,
      riskVerdict,
      repository,
      createdAt
    );
  } catch (error) {
    if (
      error instanceof UnsupportedExecutionIntentError ||
      (error instanceof Error && error.name === "UnsupportedExecutionIntentError")
    ) {
      return null;
    }

    throw error;
  }
}
