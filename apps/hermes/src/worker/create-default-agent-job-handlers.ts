import type { AgentJobType } from "@big-banana/domain";
import type { AgentJobHandler } from "./agent-job-handler";

export function createDefaultAgentJobHandlers(): Partial<
  Record<AgentJobType, AgentJobHandler>
> {
  return {
    replay_planner: async (job, context) => {
      context.logger.info(
        `[hermes] replay_planner completed for job ${job.id} (${job.market}:${job.symbol ?? "unknown"})`
      );

      return {
        jobType: job.jobType,
        market: job.market,
        symbol: job.symbol,
        timeframe: job.timeframe,
        handledAt: context.now(),
        payload: job.payloadJson
      };
    }
  };
}
