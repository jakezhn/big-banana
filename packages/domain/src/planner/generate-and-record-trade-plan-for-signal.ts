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

export { InvalidGeneratedTradePlanError } from "./generate-and-record-trade-plan-with-generator";

export type GenerateAndRecordTradePlanForSignalResult =
  GenerateAndRecordTradePlanWithGeneratorResult & {
    plannerInput: PlannerInput;
    tradePlan: ReturnType<typeof generateDeterministicTradePlan>;
  };

export async function generateAndRecordTradePlanForSignal(
  envelope: CanonicalEnvelope,
  plannerInputDependencies: PlannerInputBuildDependencies,
  tradePlanVersionRepository: TradePlanVersionRepository,
  agentRunRepository: AgentRunRepository,
  startedAt = new Date().toISOString()
): Promise<GenerateAndRecordTradePlanForSignalResult> {
  return generateAndRecordTradePlanWithGenerator(
    envelope,
    plannerInputDependencies,
    tradePlanVersionRepository,
    agentRunRepository,
    ({ plannerInput, reusablePlan }) =>
      generateDeterministicTradePlan(plannerInput, reusablePlan),
    {
      runnerKind: "deterministic",
      model: null
    },
    startedAt
  );
}
