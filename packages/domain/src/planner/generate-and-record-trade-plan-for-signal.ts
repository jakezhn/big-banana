import type { AgentRunRepository } from "../agent-runs/agent-run-repository";
import type { TradePlanVersionRepository } from "../plans/trade-plan-version-repository";
import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload";
import {
  type PlannerInput,
  type PlannerInputBuildDependencies
} from "./build-planner-input";
import { generateDeterministicTradePlan } from "./generate-deterministic-trade-plan";
import {
  generateAndRecordTradePlanWithGenerator,
  type GenerateAndRecordTradePlanWithGeneratorResult
} from "./generate-and-record-trade-plan-with-generator";
import type { RecordGeneratedTradePlanResult } from "../plans/record-generated-trade-plan";

export { InvalidGeneratedTradePlanError } from "./generate-and-record-trade-plan-with-generator";

export type GenerateAndRecordTradePlanForSignalResult =
  Omit<GenerateAndRecordTradePlanWithGeneratorResult, "recordResult"> & {
    plannerInput: PlannerInput;
    tradePlan: ReturnType<typeof generateDeterministicTradePlan>;
    recordResult: RecordGeneratedTradePlanResult;
  };

export async function generateAndRecordTradePlanForSignal(
  envelope: CanonicalEnvelope,
  plannerInputDependencies: PlannerInputBuildDependencies,
  tradePlanVersionRepository: TradePlanVersionRepository,
  agentRunRepository: AgentRunRepository,
  startedAt = new Date().toISOString()
): Promise<GenerateAndRecordTradePlanForSignalResult> {
  const result = await generateAndRecordTradePlanWithGenerator(
    envelope,
    plannerInputDependencies,
    tradePlanVersionRepository,
    agentRunRepository,
    ({ plannerInput, reusablePlan }) =>
      generateDeterministicTradePlan(plannerInput, reusablePlan),
    {
      runnerKind: "deterministic",
      modelProvider: null,
      model: null,
      skillName: "generate_trade_plan",
      promptVersion: "deterministic-v1"
    },
    startedAt
  );

  if (!result.recordResult) {
    throw new Error("Signal planner flow expected a persisted trade plan version");
  }

  return {
    ...result,
    recordResult: result.recordResult
  };
}
