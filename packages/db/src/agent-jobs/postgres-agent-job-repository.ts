import {
  buildAgentJobFailureState,
  type AgentJobRepository,
  type ClaimNextAgentJobInput,
  type EnqueueAgentJobInput,
  type StoredAgentJob
} from "@big-banana/domain";
import { type Sql } from "postgres";
import { getSharedSqlClientFromEnv } from "../sql/shared-sql-client";

type AgentJobRow = {
  id: string;
  job_type: StoredAgentJob["jobType"];
  status: StoredAgentJob["status"];
  market: StoredAgentJob["market"];
  symbol: string | null;
  timeframe: string | null;
  signal_id: string | null;
  plan_id: string | null;
  priority: number;
  idempotency_key: string;
  payload_json: StoredAgentJob["payloadJson"];
  result_ref_json: StoredAgentJob["resultRefJson"];
  locked_by: string | null;
  locked_at: string | null;
  locked_until: string | null;
  attempt_count: number;
  max_attempts: number;
  run_after: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export class PostgresAgentJobRepository implements AgentJobRepository {
  constructor(private readonly sql: Sql) {}

  async enqueueJob(input: EnqueueAgentJobInput): Promise<StoredAgentJob> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const runAfter = input.runAfter ?? createdAt;
    const [row] = await this.sql<AgentJobRow[]>`
      insert into agent_jobs (
        job_type,
        status,
        market,
        symbol,
        timeframe,
        signal_id,
        plan_id,
        priority,
        idempotency_key,
        payload_json,
        result_ref_json,
        locked_by,
        locked_at,
        locked_until,
        attempt_count,
        max_attempts,
        run_after,
        last_error,
        created_at,
        updated_at
      ) values (
        ${input.jobType},
        'pending',
        ${input.market},
        ${input.symbol ?? null},
        ${input.timeframe ?? null},
        ${input.signalId ?? null},
        ${input.planId ?? null},
        ${input.priority ?? 5},
        ${input.idempotencyKey},
        ${this.sql.json(input.payloadJson)},
        null,
        null,
        null,
        null,
        0,
        ${input.maxAttempts ?? 3},
        ${runAfter},
        null,
        ${createdAt},
        ${createdAt}
      )
      on conflict (idempotency_key)
      do nothing
      returning *
    `;

    if (row) {
      return mapAgentJobRow(row);
    }

    const existing = await this.getJobByIdempotencyKey(input.idempotencyKey);

    if (!existing) {
      throw new Error("Failed to enqueue agent job");
    }

    return existing;
  }

  async getJobById(jobId: string): Promise<StoredAgentJob | null> {
    const [row] = await this.sql<AgentJobRow[]>`
      select *
      from agent_jobs
      where id = ${jobId}
      limit 1
    `;

    return row ? mapAgentJobRow(row) : null;
  }

  async getJobByIdempotencyKey(
    idempotencyKey: string
  ): Promise<StoredAgentJob | null> {
    const [row] = await this.sql<AgentJobRow[]>`
      select *
      from agent_jobs
      where idempotency_key = ${idempotencyKey}
      limit 1
    `;

    return row ? mapAgentJobRow(row) : null;
  }

  async claimNextJob(input: ClaimNextAgentJobInput): Promise<StoredAgentJob | null> {
    const now = input.now ?? new Date().toISOString();
    const lockedUntil = new Date(
      Date.parse(now) + input.lockTtlSeconds * 1000
    ).toISOString();

    return this.sql.begin(async (sql) => {
      const jobTypeFilter =
        input.jobTypes && input.jobTypes.length > 0
          ? sql`and job_type = any(${sql.array(input.jobTypes)})`
          : sql``;
      const marketFilter =
        input.markets && input.markets.length > 0
          ? sql`and market = any(${sql.array(input.markets)})`
          : sql``;

      const [candidate] = await sql<Pick<AgentJobRow, "id">[]>`
        select id
        from agent_jobs
        where status = 'pending'
          and run_after <= ${now}
          and (locked_until is null or locked_until <= ${now})
          ${jobTypeFilter}
          ${marketFilter}
        order by priority asc, run_after asc, created_at asc
        for update skip locked
        limit 1
      `;

      if (!candidate) {
        return null;
      }

      const [claimed] = await sql<AgentJobRow[]>`
        update agent_jobs
        set
          status = 'running',
          locked_by = ${input.workerId},
          locked_at = ${now},
          locked_until = ${lockedUntil},
          updated_at = ${now}
        where id = ${candidate.id}
        returning *
      `;

      if (!claimed) {
        return null;
      }

      return mapAgentJobRow(claimed);
    });
  }

  async markJobCompleted(
    jobId: string,
    workerId: string,
    completedAt: string,
    resultRefJson: StoredAgentJob["resultRefJson"]
  ): Promise<StoredAgentJob> {
    const [row] = await this.sql<AgentJobRow[]>`
      update agent_jobs
      set
        status = 'completed',
        result_ref_json = ${resultRefJson === null ? null : this.sql.json(resultRefJson)},
        locked_by = null,
        locked_at = null,
        locked_until = null,
        updated_at = ${completedAt}
      where id = ${jobId}
        and locked_by = ${workerId}
      returning *
    `;

    if (!row) {
      throw new Error("Failed to mark agent job completed");
    }

    return mapAgentJobRow(row);
  }

  async reportJobFailure(
    jobId: string,
    workerId: string,
    failedAt: string,
    errorMessage: string
  ): Promise<StoredAgentJob> {
    const current = await this.getJobById(jobId);

    if (!current || current.lockedBy !== workerId) {
      throw new Error("Failed to report agent job failure");
    }

    const nextState = buildAgentJobFailureState(current, failedAt, errorMessage);
    const [row] = await this.sql<AgentJobRow[]>`
      update agent_jobs
      set
        status = ${nextState.status},
        attempt_count = ${nextState.attemptCount},
        run_after = ${nextState.runAfter},
        last_error = ${nextState.lastError},
        locked_by = null,
        locked_at = null,
        locked_until = null,
        updated_at = ${failedAt}
      where id = ${jobId}
        and locked_by = ${workerId}
      returning *
    `;

    if (!row) {
      throw new Error("Failed to update agent job failure state");
    }

    return mapAgentJobRow(row);
  }

  async requeueTimedOutJobs(now: string): Promise<number> {
    return this.sql.begin(async (sql) => {
      const rows = await sql<AgentJobRow[]>`
        select *
        from agent_jobs
        where status = 'running'
          and locked_until is not null
          and locked_until <= ${now}
        for update skip locked
      `;

      for (const row of rows) {
        const current = mapAgentJobRow(row);
        const nextState = buildAgentJobFailureState(
          current,
          now,
          "Agent job lock expired"
        );

        await sql`
          update agent_jobs
          set
            status = ${nextState.status},
            attempt_count = ${nextState.attemptCount},
            run_after = ${nextState.runAfter},
            last_error = ${nextState.lastError},
            locked_by = null,
            locked_at = null,
            locked_until = null,
            updated_at = ${now}
          where id = ${current.id}
        `;
      }

      return rows.length;
    });
  }

  async cancelJob(jobId: string, cancelledAt: string): Promise<StoredAgentJob> {
    const [row] = await this.sql<AgentJobRow[]>`
      update agent_jobs
      set
        status = 'cancelled',
        locked_by = null,
        locked_at = null,
        locked_until = null,
        updated_at = ${cancelledAt}
      where id = ${jobId}
      returning *
    `;

    if (!row) {
      throw new Error("Failed to cancel agent job");
    }

    return mapAgentJobRow(row);
  }
}

function mapAgentJobRow(row: AgentJobRow): StoredAgentJob {
  return {
    id: row.id,
    jobType: row.job_type,
    status: row.status,
    market: row.market,
    symbol: row.symbol,
    timeframe: row.timeframe,
    signalId: row.signal_id,
    planId: row.plan_id,
    priority: row.priority,
    idempotencyKey: row.idempotency_key,
    payloadJson: row.payload_json,
    resultRefJson: row.result_ref_json,
    lockedBy: row.locked_by,
    lockedAt: row.locked_at,
    lockedUntil: row.locked_until,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    runAfter: row.run_after,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createAgentJobRepositoryFromEnv(): PostgresAgentJobRepository {
  return new PostgresAgentJobRepository(getSharedSqlClientFromEnv());
}
