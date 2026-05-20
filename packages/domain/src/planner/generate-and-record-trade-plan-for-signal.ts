import { validateTradePlan } from "@big-banana/contracts";
import type { MarketStateRepository } from "../market-state/market-state-repository";
import {
  recordGeneratedTradePlan,
  type RecordGeneratedTradePlanResult
} from "../plans/record-generated-trade-plan";
import type { TradePlanVersionRepository } from "../plans/trade-plan-version-repository";
import { isTerminalPlanState } from "../state-machines/plan-state-machine";
import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload";
import {
  buildPlannerInput,
  type PlannerInput
} from "./build-planner-input";
import { generateDeterministicTradePlan } from "./generate-deterministic-trade-plan";

export class InvalidGeneratedTradePlanError extends Error {
  constructor() {
    super("Generated trade plan does not satisfy the frozen schema");
    this.name = "InvalidGeneratedTradePlanError";
  }
}

export type GenerateAndRecordTradePlanForSignalResult = {
  plannerInput: PlannerInput;
  tradePlan: ReturnType<typeof generateDeterministicTradePlan>;
  recordResult: RecordGeneratedTradePlanResult;
};

export async function generateAndRecordTradePlanForSignal(
  envelope: CanonicalEnvelope,
  marketStateRepository: MarketStateRepository,
  tradePlanVersionRepository: TradePlanVersionRepository
): Promise<GenerateAndRecordTradePlanForSignalResult> {
  const plannerInput = await buildPlannerInput(envelope, marketStateRepository);
  const activePlan =
    await tradePlanVersionRepository.getLatestTradePlanVersionByMarketKey(
      envelope.marketKey
    );
  const reusablePlan =
    activePlan && !isTerminalPlanState(activePlan.executionPlaybook.state)
      ? activePlan
      : null;
  const tradePlan = generateDeterministicTradePlan(plannerInput, reusablePlan);

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

  return {
    plannerInput,
    tradePlan,
    recordResult
  };
}
