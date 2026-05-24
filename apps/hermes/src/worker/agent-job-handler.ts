import type { JsonValue, StoredAgentJob } from "@big-banana/domain";

export type AgentJobHandlerContext = {
  now: () => string;
  logger: Pick<Console, "info" | "warn" | "error">;
};

export type AgentJobHandler = (
  job: StoredAgentJob,
  context: AgentJobHandlerContext
) => Promise<JsonValue | null>;
