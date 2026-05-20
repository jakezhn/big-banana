import {
  createExecutionIntentRepositoryFromEnv,
  createMarketPipelineReadModelRepositoryFromEnv,
  createOrderRepositoryFromEnv
} from "@big-banana/db";
import type {
  ExecutionIntentRepository,
  MarketPipelineReadModelRepository,
  OrderRepository
} from "@big-banana/domain";
import { handleInterveneMarketPipelineRequest } from "../../../../src/interventions/handle-intervene-market-pipeline-request";

let marketPipelineReadModelRepository:
  | MarketPipelineReadModelRepository
  | undefined;
let executionIntentRepository: ExecutionIntentRepository | undefined;
let orderRepository: OrderRepository | undefined;

export async function POST(request: Request): Promise<Response> {
  return handleInterveneMarketPipelineRequest(
    request,
    getMarketPipelineReadModelRepository(),
    getExecutionIntentRepository(),
    getOrderRepository()
  );
}

function getMarketPipelineReadModelRepository(): MarketPipelineReadModelRepository {
  marketPipelineReadModelRepository ??=
    createMarketPipelineReadModelRepositoryFromEnv();
  return marketPipelineReadModelRepository;
}

function getExecutionIntentRepository(): ExecutionIntentRepository {
  executionIntentRepository ??= createExecutionIntentRepositoryFromEnv();
  return executionIntentRepository;
}

function getOrderRepository(): OrderRepository {
  orderRepository ??= createOrderRepositoryFromEnv();
  return orderRepository;
}
