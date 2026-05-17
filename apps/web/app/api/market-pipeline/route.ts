import { createMarketPipelineReadModelRepositoryFromEnv } from "@big-banana/db";
import type { MarketPipelineReadModelRepository } from "@big-banana/domain";
import { handleGetMarketPipelineRequest } from "../../../src/markets/handle-get-market-pipeline-request.js";

let marketPipelineReadModelRepository:
  | MarketPipelineReadModelRepository
  | undefined;

export async function GET(request: Request): Promise<Response> {
  return handleGetMarketPipelineRequest(
    request,
    getMarketPipelineReadModelRepository()
  );
}

function getMarketPipelineReadModelRepository(): MarketPipelineReadModelRepository {
  marketPipelineReadModelRepository ??=
    createMarketPipelineReadModelRepositoryFromEnv();
  return marketPipelineReadModelRepository;
}
