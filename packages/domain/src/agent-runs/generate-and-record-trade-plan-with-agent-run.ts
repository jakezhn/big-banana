import type { CanonicalEnvelope } from "../tradingview/normalize-tradingview-payload";
import {
  generateAndRecordTradePlanForSignal,
  type GenerateAndRecordTradePlanForSignalResult
} from "../planner/generate-and-record-trade-plan-for-signal";
import type { MarketStateRepository } from "../market-state/market-state-repository";
import type { TradePlanVersionRepository } from "../plans/trade-plan-version-repository";
import type {
  AgentRunRepository,
  StoredAgentRun
} from "./agent-run-repository";

export type GenerateAndRecordTradePlanWithAgentRunResult = {
  plan: GenerateAndRecordTradePlanForSignalResult;
  agentRun: StoredAgentRun;
};

export async function generateAndRecordTradePlanWithAgentRun(
  envelope: CanonicalEnvelope,
  marketStateRepository: MarketStateRepository,
  tradePlanVersionRepository: TradePlanVersionRepository,
  agentRunRepository: AgentRunRepository,
  startedAt = new Date().toISOString()
): Promise<GenerateAndRecordTradePlanWithAgentRunResult> {
  const plan = await generateAndRecordTradePlanForSignal(
    envelope,
    marketStateRepository,
    tradePlanVersionRepository,
    agentRunRepository,
    startedAt
  );

  return {
    plan,
    agentRun: plan.agentRun
  };
}
