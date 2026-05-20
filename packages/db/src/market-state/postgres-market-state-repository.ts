import type {
  MarketStateRepository,
  ReceivedMarketState,
  StoredMarketState
} from "@big-banana/domain";
import { type Sql } from "postgres";
import { getSharedSqlClientFromEnv } from "../sql/shared-sql-client";

type MarketStateHistoryRow = {
  id: string;
  market_key: string;
  webhook_event_id: string;
  tickerid: string;
  timeframe: string;
  bar_time_ms: string | number;
  context_json: ReceivedMarketState["context"];
  created_at: string;
};

export class PostgresMarketStateRepository implements MarketStateRepository {
  constructor(private readonly sql: Sql) {}

  async recordMarketState(
    state: ReceivedMarketState
  ): Promise<StoredMarketState> {
    await this.sql`
      insert into market_states_current (
        market_key,
        webhook_event_id,
        tickerid,
        timeframe,
        bar_time_ms,
        context_json,
        updated_at
      ) values (
        ${state.marketKey},
        ${state.webhookEventId},
        ${state.tickerid},
        ${state.timeframe},
        ${state.barTimeMs},
        ${this.sql.json(state.context)},
        ${state.createdAt}
      )
      on conflict (market_key)
      do update set
        webhook_event_id = excluded.webhook_event_id,
        tickerid = excluded.tickerid,
        timeframe = excluded.timeframe,
        bar_time_ms = excluded.bar_time_ms,
        context_json = excluded.context_json,
        updated_at = excluded.updated_at
      where excluded.bar_time_ms >= market_states_current.bar_time_ms
    `;

    const [row] = await this.sql<MarketStateHistoryRow[]>`
      insert into market_states_history (
        market_key,
        webhook_event_id,
        tickerid,
        timeframe,
        bar_time_ms,
        context_json,
        created_at
      ) values (
        ${state.marketKey},
        ${state.webhookEventId},
        ${state.tickerid},
        ${state.timeframe},
        ${state.barTimeMs},
        ${this.sql.json(state.context)},
        ${state.createdAt}
      )
      on conflict (tickerid, timeframe, bar_time_ms)
      do update set
        webhook_event_id = excluded.webhook_event_id
      returning *
    `;

    if (!row) {
      throw new Error("Failed to persist market state");
    }

    return {
      id: row.id,
      marketKey: row.market_key,
      webhookEventId: row.webhook_event_id,
      tickerid: row.tickerid,
      timeframe: row.timeframe,
      barTimeMs: Number(row.bar_time_ms),
      context: row.context_json,
      createdAt: row.created_at
    };
  }

  async getLatestStatesByTickerid(tickerid: string): Promise<StoredMarketState[]> {
    const rows = await this.sql<MarketStateHistoryRow[]>`
      select
        market_key,
        webhook_event_id,
        tickerid,
        timeframe,
        bar_time_ms,
        context_json,
        updated_at as created_at
      from market_states_current
      where tickerid = ${tickerid}
      order by timeframe asc
    `;

    return rows.map((row) => ({
      id: row.market_key,
      marketKey: row.market_key,
      webhookEventId: row.webhook_event_id,
      tickerid: row.tickerid,
      timeframe: row.timeframe,
      barTimeMs: Number(row.bar_time_ms),
      context: row.context_json,
      createdAt: row.created_at
    }));
  }
}

export function createMarketStateRepositoryFromEnv(): PostgresMarketStateRepository {
  return new PostgresMarketStateRepository(getSharedSqlClientFromEnv());
}
