import type {
  DashboardAgentRunListItem,
  DashboardOverviewReadModel,
  DashboardPipelineListItem,
  DashboardReadModelRepository
} from "@big-banana/domain";
import { type Sql } from "postgres";
import { getSharedSqlClientFromEnv } from "../sql/shared-sql-client";

type CountRow = {
  count: string | number;
};

type PipelineListRow = {
  market_key: string;
  tickerid: string;
  timeframe: string;
  updated_at: string;
  pipeline_status: DashboardPipelineListItem["pipelineStatus"];
  trade_plan_action: DashboardPipelineListItem["tradePlanAction"];
  risk_verdict: DashboardPipelineListItem["riskVerdict"];
  latest_order_status: string | null;
};

type AgentRunListRow = {
  id: string;
  market_key: string;
  source_event_key: string;
  operation: string;
  runner_kind: string;
  model: string | null;
  status: DashboardAgentRunListItem["status"];
  trade_plan_version_id: string | null;
  error_message: string | null;
  started_at: string;
  completed_at: string;
  latency_ms: number;
};

export class PostgresDashboardReadModelRepository
  implements DashboardReadModelRepository
{
  constructor(private readonly sql: Sql) {}

  async getOverview(): Promise<DashboardOverviewReadModel> {
    const [
      signalsTodayCount,
      plansTodayCount,
      riskRejectsTodayCount,
      ordersSubmittedTodayCount,
      ordersFilledTodayCount,
      ordersCanceledTodayCount,
      openPositionsCount,
      interventionsTodayCount
    ] = await Promise.all([
      this.countRowsToday("webhook_events", "received_at", sql => sql`
        event_type = 'signal'
      `),
      this.countRowsToday("trade_plan_versions", "created_at"),
      this.countRowsToday("risk_verdicts", "created_at", sql => sql`
        verdict = 'reject'
      `),
      this.countRowsToday("orders", "submitted_at"),
      this.countRowsToday("orders", "submitted_at", sql => sql`
        status = 'filled'
      `),
      this.countRowsToday("orders", "submitted_at", sql => sql`
        status = 'canceled'
      `),
      this.countOpenPositions(),
      this.countRowsToday("execution_intents", "created_at", sql => sql`
        payload_json ->> 'action' = 'close'
      `)
    ]);

    return {
      signalsTodayCount,
      plansTodayCount,
      riskRejectsTodayCount,
      ordersSubmittedTodayCount,
      ordersFilledTodayCount,
      ordersCanceledTodayCount,
      openPositionsCount,
      interventionsTodayCount
    };
  }

  async listRecentPipelines(limit: number): Promise<DashboardPipelineListItem[]> {
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.trunc(limit), 1), 100)
      : 20;

    const rows = await this.sql<PipelineListRow[]>`
      select
        m.market_key,
        m.tickerid,
        m.timeframe,
        m.updated_at,
        case
          when o.status in ('filled', 'canceled', 'rejected', 'reconciled_absent') then 'order_terminal'
          when o.id is not null then 'order_submitted'
          when rv.verdict = 'reject' then 'risk_rejected'
          when ei.id is not null then 'intent_ready'
          when rv.id is not null then 'risk_approved'
          when tp.id is not null then 'plan_ready'
          else 'normalized'
        end as pipeline_status,
        tp.action as trade_plan_action,
        rv.verdict as risk_verdict,
        o.status as latest_order_status
      from market_states_current m
      left join lateral (
        select id, action
        from trade_plan_versions
        where market_key = m.market_key
        order by created_at desc, version desc
        limit 1
      ) tp on true
      left join lateral (
        select id, verdict
        from risk_verdicts
        where trade_plan_version_id = tp.id
        order by created_at desc
        limit 1
      ) rv on true
      left join lateral (
        select id
        from execution_intents
        where risk_verdict_id = rv.id
        order by created_at desc
        limit 1
      ) ei on true
      left join lateral (
        select id, status
        from orders
        where execution_intent_id = ei.id
        order by submitted_at desc
        limit 1
      ) o on true
      order by m.updated_at desc
      limit ${safeLimit}
    `;

    return rows.map(row => ({
      marketKey: row.market_key,
      tickerid: row.tickerid,
      timeframe: row.timeframe,
      updatedAt: row.updated_at,
      pipelineStatus: row.pipeline_status,
      tradePlanAction: row.trade_plan_action,
      riskVerdict: row.risk_verdict,
      latestOrderStatus: row.latest_order_status
    }));
  }

  async listRecentAgentRuns(limit: number): Promise<DashboardAgentRunListItem[]> {
    const safeLimit = Number.isFinite(limit)
      ? Math.min(Math.max(Math.trunc(limit), 1), 100)
      : 20;

    const rows = await this.sql<AgentRunListRow[]>`
      select
        id,
        market_key,
        source_event_key,
        operation,
        runner_kind,
        model,
        status,
        trade_plan_version_id,
        error_message,
        started_at,
        completed_at,
        latency_ms
      from agent_runs
      order by started_at desc
      limit ${safeLimit}
    `;

    return rows.map((row) => ({
      id: row.id,
      marketKey: row.market_key,
      sourceEventKey: row.source_event_key,
      operation: row.operation,
      runnerKind: row.runner_kind,
      model: row.model,
      status: row.status,
      tradePlanVersionId: row.trade_plan_version_id,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      latencyMs: row.latency_ms
    }));
  }

  private async countOpenPositions(): Promise<number> {
    const [row] = await this.sql<CountRow[]>`
      select count(*)::text as count
      from positions_current
      where signed_qty <> 0
    `;

    return toCount(row);
  }

  private async countRowsToday(
    tableName: string,
    timestampColumn: string,
    extraWhere?: (sql: Sql) => ReturnType<Sql>
  ): Promise<number> {
    const table = this.sql(tableName);
    const timestamp = this.sql(timestampColumn);
    const [row] = extraWhere
      ? await this.sql<CountRow[]>`
          select count(*)::text as count
          from ${table}
          where ${timestamp} >= date_trunc('day', now())
            and ${extraWhere(this.sql)}
        `
      : await this.sql<CountRow[]>`
          select count(*)::text as count
          from ${table}
          where ${timestamp} >= date_trunc('day', now())
        `;

    return toCount(row);
  }
}

export function createDashboardReadModelRepositoryFromEnv(): PostgresDashboardReadModelRepository {
  return new PostgresDashboardReadModelRepository(getSharedSqlClientFromEnv());
}

function toCount(row: CountRow | undefined): number {
  return Number(row?.count ?? 0);
}
