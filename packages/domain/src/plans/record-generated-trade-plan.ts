import { randomUUID } from "node:crypto";
import type { TradePlan } from "@big-banana/contracts";
import { assertPlanStateTransition } from "../state-machines/plan-state-machine.js";
import type {
  StoredPlanTransition,
  StoredTradePlanVersion,
  TradePlanVersionRepository
} from "./trade-plan-version-repository.js";

export type RecordGeneratedTradePlanInput = {
  tradePlan: TradePlan;
  marketKey: string;
  sourceEventKey: string;
  planId?: string;
  createdAt?: string;
  transitionReasonCode?: string;
};

export type RecordGeneratedTradePlanResult = {
  tradePlanVersion: StoredTradePlanVersion;
  planTransition: StoredPlanTransition | null;
};

export async function recordGeneratedTradePlan(
  input: RecordGeneratedTradePlanInput,
  repository: TradePlanVersionRepository
): Promise<RecordGeneratedTradePlanResult> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const planId = input.planId ?? randomUUID();
  const latestVersion = await repository.getLatestTradePlanVersion(planId);
  const version = (latestVersion?.version ?? 0) + 1;

  const tradePlanVersion = await repository.recordTradePlanVersion({
    planId,
    version,
    marketKey: input.marketKey,
    sourceEventKey: input.sourceEventKey,
    action: input.tradePlan.action,
    marketThesis: input.tradePlan.market_thesis,
    executionPlaybook: input.tradePlan.execution_playbook,
    riskIntent: input.tradePlan.risk_intent,
    reasoningSummary: input.tradePlan.reasoning_summary,
    evidence: input.tradePlan.evidence,
    createdAt
  });

  const previousState = latestVersion?.executionPlaybook.state ?? null;
  const nextState = input.tradePlan.execution_playbook.state;

  if (input.tradePlan.action === "skip" || previousState === nextState) {
    return {
      tradePlanVersion,
      planTransition: null
    };
  }

  if (previousState !== null) {
    assertPlanStateTransition(previousState, nextState);
  }

  const planTransition = await repository.recordPlanTransition({
    planId,
    version,
    fromState: previousState,
    toState: nextState,
    reasonCode: input.transitionReasonCode ?? "plan_generated",
    createdAt
  });

  return {
    tradePlanVersion,
    planTransition
  };
}
