import {
  createMarketPipelineReadModelRepositoryFromEnv,
  createOrderRepositoryFromEnv
} from "@big-banana/db";
import type {
  MarketPipelineReadModelRepository,
  OrderRepository
} from "@big-banana/domain";
import { handleSubmitMarketPipelineRequest } from "../../../../src/orders/handle-submit-market-pipeline-request";

let marketPipelineReadModelRepository:
  | MarketPipelineReadModelRepository
  | undefined;
let orderRepository: OrderRepository | undefined;

export async function POST(request: Request): Promise<Response> {
  return handleSubmitMarketPipelineRequest(
    request,
    getMarketPipelineReadModelRepository(),
    getOrderRepository()
  );
}

function getMarketPipelineReadModelRepository(): MarketPipelineReadModelRepository {
  marketPipelineReadModelRepository ??=
    createMarketPipelineReadModelRepositoryFromEnv();
  return marketPipelineReadModelRepository;
}

function getOrderRepository(): OrderRepository {
  orderRepository ??= createOrderRepositoryFromEnv();
  return orderRepository;
}
