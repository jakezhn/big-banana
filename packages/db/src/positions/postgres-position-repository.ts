import type {
  PositionRepository,
  ReceivedPositionHistoryEntry,
  ReceivedPositionSnapshot,
  StoredPositionHistoryEntry,
  StoredPositionSnapshot
} from "@big-banana/domain";
import { type Sql } from "postgres";
import { getSharedSqlClientFromEnv } from "../sql/shared-sql-client";

type PositionCurrentRow = {
  id: string;
  trading_account_id: string;
  symbol: string;
  market_key: string;
  position_side: StoredPositionSnapshot["positionSide"];
  signed_qty: string | number;
  avg_entry_price: string | number | null;
  opened_at: string | null;
  closed_at: string | null;
  updated_at: string;
  last_fill_id: string;
};

type PositionHistoryRow = {
  id: string;
  position_id: string;
  trading_account_id: string;
  symbol: string;
  market_key: string;
  position_side: StoredPositionHistoryEntry["positionSide"];
  signed_qty: string | number;
  avg_entry_price: string | number | null;
  source_fill_id: string;
  event_type: StoredPositionHistoryEntry["eventType"];
  recorded_at: string;
};

export class PostgresPositionRepository implements PositionRepository {
  constructor(private readonly sql: Sql) {}

  async getCurrentPosition(
    tradingAccountId: string,
    symbol: string
  ): Promise<StoredPositionSnapshot | null> {
    const [row] = await this.sql<PositionCurrentRow[]>`
      select *
      from positions_current
      where trading_account_id = ${tradingAccountId}
        and symbol = ${symbol}
      limit 1
    `;

    return row ? mapCurrentRow(row) : null;
  }

  async upsertCurrentPosition(
    position: ReceivedPositionSnapshot
  ): Promise<StoredPositionSnapshot> {
    const [row] = await this.sql<PositionCurrentRow[]>`
      insert into positions_current (
        trading_account_id,
        symbol,
        market_key,
        position_side,
        signed_qty,
        avg_entry_price,
        opened_at,
        closed_at,
        updated_at,
        last_fill_id
      ) values (
        ${position.tradingAccountId},
        ${position.symbol},
        ${position.marketKey},
        ${position.positionSide},
        ${position.signedQty},
        ${position.avgEntryPrice},
        ${position.openedAt},
        ${position.closedAt},
        ${position.updatedAt},
        ${position.lastFillId}
      )
      on conflict (trading_account_id, symbol)
      do update set
        market_key = excluded.market_key,
        position_side = excluded.position_side,
        signed_qty = excluded.signed_qty,
        avg_entry_price = excluded.avg_entry_price,
        opened_at = excluded.opened_at,
        closed_at = excluded.closed_at,
        updated_at = excluded.updated_at,
        last_fill_id = excluded.last_fill_id
      returning *
    `;

    if (!row) {
      throw new Error("Failed to upsert current position");
    }

    return mapCurrentRow(row);
  }

  async recordPositionHistory(
    entry: ReceivedPositionHistoryEntry
  ): Promise<StoredPositionHistoryEntry> {
    const [row] = await this.sql<PositionHistoryRow[]>`
      insert into positions_history (
        position_id,
        trading_account_id,
        symbol,
        market_key,
        position_side,
        signed_qty,
        avg_entry_price,
        source_fill_id,
        event_type,
        recorded_at
      ) values (
        ${entry.positionId},
        ${entry.tradingAccountId},
        ${entry.symbol},
        ${entry.marketKey},
        ${entry.positionSide},
        ${entry.signedQty},
        ${entry.avgEntryPrice},
        ${entry.sourceFillId},
        ${entry.eventType},
        ${entry.recordedAt}
      )
      returning *
    `;

    if (!row) {
      throw new Error("Failed to persist position history");
    }

    return mapHistoryRow(row);
  }
}

function mapCurrentRow(row: PositionCurrentRow): StoredPositionSnapshot {
  return {
    id: row.id,
    tradingAccountId: row.trading_account_id,
    symbol: row.symbol,
    marketKey: row.market_key,
    positionSide: row.position_side,
    signedQty: toNumber(row.signed_qty),
    avgEntryPrice: toNumberOrNull(row.avg_entry_price),
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    updatedAt: row.updated_at,
    lastFillId: row.last_fill_id
  };
}

function mapHistoryRow(row: PositionHistoryRow): StoredPositionHistoryEntry {
  return {
    id: row.id,
    positionId: row.position_id,
    tradingAccountId: row.trading_account_id,
    symbol: row.symbol,
    marketKey: row.market_key,
    positionSide: row.position_side,
    signedQty: toNumber(row.signed_qty),
    avgEntryPrice: toNumberOrNull(row.avg_entry_price),
    sourceFillId: row.source_fill_id,
    eventType: row.event_type,
    recordedAt: row.recorded_at
  };
}

export function createPositionRepositoryFromEnv(): PostgresPositionRepository {
  return new PostgresPositionRepository(getSharedSqlClientFromEnv());
}

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function toNumberOrNull(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  return toNumber(value);
}
