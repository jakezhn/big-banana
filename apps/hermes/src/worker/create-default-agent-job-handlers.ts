import type {
  AgentJobType,
  AgentRunRepository,
  MarketStateRepository,
  OrderRepository,
  PositionRepository,
  TradePlanVersionRepository
} from "@big-banana/domain";
import type { AgentJobHandler } from "./agent-job-handler";
import { createReplayPlannerHandler } from "./replay/replay-planner-handler";

export type DefaultAgentJobHandlerDependencies = {
  marketStateRepository: MarketStateRepository;
  tradePlanVersionRepository: TradePlanVersionRepository;
  orderRepository: OrderRepository;
  positionRepository: PositionRepository;
  agentRunRepository: AgentRunRepository;
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
    replay_planner: createReplayPlannerHandler(dependencies)
  };
}
