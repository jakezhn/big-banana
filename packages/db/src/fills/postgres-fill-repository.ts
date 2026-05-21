import type { FillRepository, ReceivedFill, StoredFill } from "@big-banana/domain";
import { type Sql } from "postgres";
import { getSharedSqlClientFromEnv } from "../sql/shared-sql-client";

type FillRow = {
  id: string;
  order_id: string;
  execution_intent_id: string;
  trading_account_id: string;
  venue: string;
  symbol: string;
  side: StoredFill["side"];
  qty: string | number;
  price: string | number;
  filled_at: string;
  exchange_fill_id: string;
  raw_exchange_json: StoredFill["rawExchangeJson"];
};

export class PostgresFillRepository implements FillRepository {
  constructor(private readonly sql: Sql) {}

  async recordFill(fill: ReceivedFill): Promise<StoredFill> {
    const [row] = await this.sql<FillRow[]>`
      insert into fills (
        order_id,
        execution_intent_id,
        trading_account_id,
        venue,
        symbol,
        side,
        qty,
        price,
        filled_at,
        exchange_fill_id,
        raw_exchange_json
      ) values (
        ${fill.orderId},
        ${fill.executionIntentId},
        ${fill.tradingAccountId},
        ${fill.venue},
        ${fill.symbol},
        ${fill.side},
        ${fill.qty},
        ${fill.price},
        ${fill.filledAt},
        ${fill.exchangeFillId},
        ${this.sql.json(fill.rawExchangeJson)}
      )
      returning *
    `;

    if (!row) {
      throw new Error("Failed to persist fill");
    }

    return mapFillRow(row);
  }

  async getLatestFillByOrderId(orderId: string): Promise<StoredFill | null> {
    const [row] = await this.sql<FillRow[]>`
      select *
      from fills
      where order_id = ${orderId}
      order by filled_at desc
      limit 1
    `;

    return row ? mapFillRow(row) : null;
  }
}

function mapFillRow(row: FillRow): StoredFill {
  return {
    id: row.id,
    orderId: row.order_id,
    executionIntentId: row.execution_intent_id,
    tradingAccountId: row.trading_account_id,
    venue: row.venue,
    symbol: row.symbol,
    side: row.side,
    qty: toNumber(row.qty),
    price: toNumber(row.price),
    filledAt: row.filled_at,
    exchangeFillId: row.exchange_fill_id,
    rawExchangeJson: row.raw_exchange_json
  };
}

export function createFillRepositoryFromEnv(): PostgresFillRepository {
  return new PostgresFillRepository(getSharedSqlClientFromEnv());
}

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}
