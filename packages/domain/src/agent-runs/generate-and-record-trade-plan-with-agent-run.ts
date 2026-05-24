import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload";
import { normalizeTradingViewPayload } from "../tradingview/normalize-tradingview-payload";
import {
  generateAndRecordTradePlanForSignal,
  type GenerateAndRecordTradePlanForSignalResult
} from "../planner/generate-and-record-trade-plan-for-signal";
import {
  generateAndRecordTradePlanWithGenerator,
  type PlannerRunnerInfo,
  type TradePlanGenerator
} from "../planner/generate-and-record-trade-plan-with-generator";
import type { TradePlanVersionRepository } from "../plans/trade-plan-version-repository";
import type {
  AgentRunRepository,
  StoredAgentRun
} from "./agent-run-repository";
import type { PlannerInputBuildDependencies } from "../planner/build-planner-input";

export type GenerateAndRecordTradePlanWithAgentRunResult = {
  plan: GenerateAndRecordTradePlanForSignalResult;
  agentRun: StoredAgentRun;
};

export type ReplayTradePlanWithAgentRunResult = {
  envelope: CanonicalEnvelope;
  tradePlan: GenerateAndRecordTradePlanForSignalResult["tradePlan"];
  agentRun: StoredAgentRun;
  plannerInput: GenerateAndRecordTradePlanForSignalResult["plannerInput"];
};

export async function generateAndRecordTradePlanWithAgentRun(
  envelope: CanonicalEnvelope,
  plannerInputDependencies: PlannerInputBuildDependencies,
  tradePlanVersionRepository: TradePlanVersionRepository,
  agentRunRepository: AgentRunRepository,
  startedAt = new Date().toISOString()
): Promise<GenerateAndRecordTradePlanWithAgentRunResult> {
  const plan = await generateAndRecordTradePlanForSignal(
    envelope,
    plannerInputDependencies,
    tradePlanVersionRepository,
    agentRunRepository,
    startedAt
  );

  return {
    plan,
    agentRun: plan.agentRun
  };
}

export async function replayTradePlanWithAgentRun(
  rawPayload: unknown,
  plannerInputDependencies: PlannerInputBuildDependencies,
  agentRunRepository: AgentRunRepository,
  generator: TradePlanGenerator,
  runner: PlannerRunnerInfo,
  receivedAt = new Date().toISOString()
): Promise<ReplayTradePlanWithAgentRunResult> {
  const envelope = normalizeTradingViewPayload(rawPayload, receivedAt);

  const replay = await generateAndRecordTradePlanWithGenerator(
    envelope,
    plannerInputDependencies,
    {
      getLatestTradePlanVersion: async () => null,
      getLatestTradePlanVersionByMarketKey: async () => null,
      recordTradePlanVersion: async () => {
        throw new Error("Replay flow must not persist trade plan versions");
      },
      recordPlanTransition: async () => {
        throw new Error("Replay flow must not persist plan transitions");
      }
    },
    agentRunRepository,
    generator,
    runner,
    receivedAt,
    {
      operation: "plan.replay",
      persistTradePlan: false
    }
  );

  return {
    envelope,
    tradePlan: replay.tradePlan,
    agentRun: replay.agentRun,
    plannerInput: replay.plannerInput
  };
}
