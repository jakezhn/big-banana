import {
  createExecutionIntentRepositoryFromEnv,
  createMarketPipelineReadModelRepositoryFromEnv
} from "@big-banana/db";
import type {
  ExecutionIntentRepository,
  MarketPipelineReadModelRepository
} from "@big-banana/domain";
import { handleApproveMarketPipelineRequest } from "../../../../src/approvals/handle-approve-market-pipeline-request";

let marketPipelineReadModelRepository:
  | MarketPipelineReadModelRepository
  | undefined;
let executionIntentRepository: ExecutionIntentRepository | undefined;

export async function POST(request: Request): Promise<Response> {
  return handleApproveMarketPipelineRequest(
    request,
    getMarketPipelineReadModelRepository(),
    getExecutionIntentRepository()
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
