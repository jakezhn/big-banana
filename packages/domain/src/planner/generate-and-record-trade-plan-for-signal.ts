import type { AgentRunRepository } from "../agent-runs/agent-run-repository";
import type { MarketStateRepository } from "../market-state/market-state-repository";
import type { TradePlanVersionRepository } from "../plans/trade-plan-version-repository";
import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload";
import { type PlannerInput } from "./build-planner-input";
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
  marketStateRepository: MarketStateRepository,
  tradePlanVersionRepository: TradePlanVersionRepository,
  agentRunRepository: AgentRunRepository,
  startedAt = new Date().toISOString()
): Promise<GenerateAndRecordTradePlanForSignalResult> {
  return generateAndRecordTradePlanWithGenerator(
    envelope,
    marketStateRepository,
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
