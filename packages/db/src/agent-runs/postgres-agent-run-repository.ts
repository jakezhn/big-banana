import type { AgentRunRepository, ReceivedAgentRun, StoredAgentRun } from "@big-banana/domain";
import { type Sql } from "postgres";
import { getSharedSqlClientFromEnv } from "../sql/shared-sql-client";

type AgentRunRow = {
  id: string;
  market_key: string;
  source_event_key: string;
  operation: string;
  runner_kind: string;
  model_provider: string | null;
  model: string | null;
  skill_name: string;
  prompt_version: string | null;
  status: StoredAgentRun["status"];
  input_summary_json: StoredAgentRun["inputSummary"];
  output_summary_json: StoredAgentRun["outputSummary"];
  token_usage_json: StoredAgentRun["tokenUsageJson"];
  execution_eligible: boolean | null;
  trade_plan_version_id: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string;
  latency_ms: number;
};

export class PostgresAgentRunRepository implements AgentRunRepository {
  constructor(private readonly sql: Sql) {}

  async recordAgentRun(run: ReceivedAgentRun): Promise<StoredAgentRun> {
    const [row] = await this.sql<AgentRunRow[]>`
      insert into agent_runs (
        market_key,
        source_event_key,
        operation,
        runner_kind,
        model_provider,
        model,
        skill_name,
        prompt_version,
        status,
        input_summary_json,
        output_summary_json,
        token_usage_json,
        execution_eligible,
        trade_plan_version_id,
        error_message,
        started_at,
        completed_at,
        latency_ms
      ) values (
        ${run.marketKey},
        ${run.sourceEventKey},
        ${run.operation},
        ${run.runnerKind},
        ${run.modelProvider},
        ${run.model},
        ${run.skillName},
        ${run.promptVersion},
        ${run.status},
        ${this.sql.json(run.inputSummary)},
        ${run.outputSummary === null ? null : this.sql.json(run.outputSummary)},
        ${run.tokenUsageJson === null ? null : this.sql.json(run.tokenUsageJson)},
        ${run.executionEligible},
        ${run.tradePlanVersionId},
        ${run.errorMessage},
        ${run.startedAt},
        ${run.completedAt},
        ${run.latencyMs}
      )
      returning *
    `;

    if (!row) {
      throw new Error("Failed to persist agent run");
    }

    return mapAgentRunRow(row);
  }
}

function mapAgentRunRow(row: AgentRunRow): StoredAgentRun {
  return {
    id: row.id,
    marketKey: row.market_key,
    sourceEventKey: row.source_event_key,
    operation: row.operation,
    runnerKind: row.runner_kind,
    modelProvider: row.model_provider,
    model: row.model,
    skillName: row.skill_name,
    promptVersion: row.prompt_version,
    status: row.status,
    inputSummary: row.input_summary_json,
    outputSummary: row.output_summary_json,
    tokenUsageJson: row.token_usage_json,
    executionEligible: row.execution_eligible,
    tradePlanVersionId: row.trade_plan_version_id,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    latencyMs: row.latency_ms
  };
}

export function createAgentRunRepositoryFromEnv(): PostgresAgentRunRepository {
  return new PostgresAgentRunRepository(getSharedSqlClientFromEnv());
}
