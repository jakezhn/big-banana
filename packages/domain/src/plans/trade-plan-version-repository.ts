import type { TradePlan } from "@big-banana/contracts";
import type { PlanState } from "../state-machines/plan-state-machine.js";

export type ReceivedTradePlanVersion = {
  planId: string;
  version: number;
  marketKey: string;
  sourceEventKey: string;
  action: TradePlan["action"];
  marketThesis: TradePlan["market_thesis"];
  executionPlaybook: TradePlan["execution_playbook"];
  riskIntent: TradePlan["risk_intent"];
  reasoningSummary: TradePlan["reasoning_summary"];
  evidence: TradePlan["evidence"];
  createdAt: string;
};

export type StoredTradePlanVersion = ReceivedTradePlanVersion & {
  id: string;
};

export type ReceivedPlanTransition = {
  planId: string;
  version: number;
  fromState: PlanState | null;
  toState: PlanState;
  reasonCode: string;
  createdAt: string;
};

export type StoredPlanTransition = ReceivedPlanTransition & {
  id: string;
};

export interface TradePlanVersionRepository {
  getLatestTradePlanVersion(planId: string): Promise<StoredTradePlanVersion | null>;

  getLatestTradePlanVersionByMarketKey(
    marketKey: string
  ): Promise<StoredTradePlanVersion | null>;

  recordTradePlanVersion(
    version: ReceivedTradePlanVersion
  ): Promise<StoredTradePlanVersion>;

  recordPlanTransition(
    transition: ReceivedPlanTransition
  ): Promise<StoredPlanTransition>;
}
