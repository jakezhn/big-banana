import {
  createMarketPipelineReadModelRepositoryFromEnv,
  createOrderRepositoryFromEnv
} from "@big-banana/db";
import type {
  MarketPipelineReadModelRepository,
  OrderRepository
} from "@big-banana/domain";
import { handleReconcileMarketPipelineRequest } from "../../../../src/orders/handle-reconcile-market-pipeline-request.js";

let marketPipelineReadModelRepository:
  | MarketPipelineReadModelRepository
  | undefined;
let orderRepository: OrderRepository | undefined;

export async function POST(request: Request): Promise<Response> {
  return handleReconcileMarketPipelineRequest(
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
