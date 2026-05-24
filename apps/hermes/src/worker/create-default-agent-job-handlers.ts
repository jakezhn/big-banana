import type {
  AgentJobType,
  AgentRunRepository,
  ExecutionIntentRepository,
  MarketStateRepository,
  OrderRepository,
  PositionRepository,
  RiskVerdictRepository,
  TradePlanVersionRepository
} from "@big-banana/domain";
import type { AgentJobHandler } from "./agent-job-handler";
import { createGeneratePlanHandler } from "./planning/generate-plan-handler";
import { createReplayPlannerHandler } from "./replay/replay-planner-handler";
import type { WebhookEventRepository } from "@big-banana/domain";

export type DefaultAgentJobHandlerDependencies = {
  webhookEventRepository: WebhookEventRepository;
  marketStateRepository: MarketStateRepository;
  tradePlanVersionRepository: TradePlanVersionRepository;
  orderRepository: OrderRepository;
  positionRepository: PositionRepository;
  agentRunRepository: AgentRunRepository;
  riskVerdictRepository: RiskVerdictRepository;
  executionIntentRepository: ExecutionIntentRepository;
  tradingAccountId: string;
};

export function createDefaultAgentJobHandlers(): Partial<
  Record<AgentJobType, AgentJobHandler>
>;
export function createDefaultAgentJobHandlers(
  dependencies: DefaultAgentJobHandlerDependencies
): Partial<Record<AgentJobType, AgentJobHandler>>;
export function createDefaultAgentJobHandlers(
  dependencies?: DefaultAgentJobHandlerDependencies
): Partial<Record<AgentJobType, AgentJobHandler>> {
  if (!dependencies) {
    return {};
  }

  return {
    generate_plan: createGeneratePlanHandler(dependencies),
    replay_planner: createReplayPlannerHandler(dependencies)
  };
}
