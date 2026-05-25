import type {
  AgentJobType,
  AgentRunRepository,
  ExecutionIntentRepository,
  MemoryLessonCandidateRepository,
  MarketStateRepository,
  MarketPipelineReadModelRepository,
  OrderRepository,
  PlanRevisionSuggestionRepository,
  PostPlanReviewRepository,
  PositionRepository,
  RiskVerdictRepository,
  TradePlanVersionRepository
} from "@big-banana/domain";
import type { AgentJobHandler } from "./agent-job-handler";
import { createGeneratePlanHandler } from "./planning/generate-plan-handler";
import { createMemoryCurateHandler } from "./memory/memory-curate-handler";
import { createReplayPlannerHandler } from "./replay/replay-planner-handler";
import { createPostPlanReviewHandler } from "./review/post-plan-review-handler";
import { createRevisePlanHandler } from "./revision/revise-plan-handler";
import type { WebhookEventRepository } from "@big-banana/domain";

export type DefaultAgentJobHandlerDependencies = {
  webhookEventRepository: WebhookEventRepository;
  marketStateRepository: MarketStateRepository;
  marketPipelineReadModelRepository: MarketPipelineReadModelRepository;
  tradePlanVersionRepository: TradePlanVersionRepository;
  orderRepository: OrderRepository;
  positionRepository: PositionRepository;
  planRevisionSuggestionRepository: PlanRevisionSuggestionRepository;
  postPlanReviewRepository: PostPlanReviewRepository;
  memoryLessonCandidateRepository: MemoryLessonCandidateRepository;
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
    memory_curate: createMemoryCurateHandler(dependencies),
    post_plan_review: createPostPlanReviewHandler(dependencies),
    revise_plan: createRevisePlanHandler(dependencies),
    replay_planner: createReplayPlannerHandler(dependencies)
  };
}
