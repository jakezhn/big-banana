import {
  createFillRepositoryFromEnv,
  createMarketPipelineReadModelRepositoryFromEnv,
  createOrderRepositoryFromEnv,
  createPositionRepositoryFromEnv
} from "@big-banana/db";
import type {
  FillRepository,
  MarketPipelineReadModelRepository,
  OrderRepository,
  PositionRepository
} from "@big-banana/domain";
import { handleReconcileMarketPipelineRequest } from "../../../../src/orders/handle-reconcile-market-pipeline-request";

let marketPipelineReadModelRepository:
  | MarketPipelineReadModelRepository
  | undefined;
let orderRepository: OrderRepository | undefined;
let fillRepository: FillRepository | undefined;
let positionRepository: PositionRepository | undefined;

export async function POST(request: Request): Promise<Response> {
  return handleReconcileMarketPipelineRequest(
    request,
    getMarketPipelineReadModelRepository(),
    getOrderRepository(),
    getFillRepository(),
    getPositionRepository()
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

function getFillRepository(): FillRepository {
  fillRepository ??= createFillRepositoryFromEnv();
  return fillRepository;
}

function getPositionRepository(): PositionRepository {
  positionRepository ??= createPositionRepositoryFromEnv();
  return positionRepository;
}
