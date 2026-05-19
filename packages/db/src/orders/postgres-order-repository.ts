import type {
  OrderRepository,
  ReceivedOrder,
  ReceivedOrderStatusUpdate,
  StoredOrder
} from "@big-banana/domain";
import postgres, { type Sql } from "postgres";

type OrderRow = {
  id: string;
  execution_intent_id: string;
  trading_account_id: string;
  venue: string;
  symbol: string;
  side: StoredOrder["side"];
  order_type: StoredOrder["orderType"];
  time_in_force: StoredOrder["timeInForce"];
  reduce_only: boolean;
  client_order_id: string;
  exchange_order_id: string | null;
  status: StoredOrder["status"];
  requested_qty: StoredOrder["requestedQty"];
  requested_price: StoredOrder["requestedPrice"];
  stop_price: StoredOrder["stopPrice"];
  avg_fill_price: StoredOrder["avgFillPrice"];
  filled_qty: StoredOrder["filledQty"];
  submitted_at: string;
  last_exchange_update_at: string;
  terminal_at: string | null;
  raw_exchange_json: StoredOrder["rawExchangeJson"];
};

export class PostgresOrderRepository implements OrderRepository {
  constructor(private readonly sql: Sql) {}

  async getLatestOrderByExecutionIntentId(
    executionIntentId: string
  ): Promise<StoredOrder | null> {
    const [row] = await this.sql<OrderRow[]>`
      select *
      from orders
      where execution_intent_id = ${executionIntentId}
      order by submitted_at desc
      limit 1
    `;

    return row ? mapOrderRow(row) : null;
  }

  async recordOrder(order: ReceivedOrder): Promise<StoredOrder> {
    const [row] = await this.sql<OrderRow[]>`
      insert into orders (
        execution_intent_id,
        trading_account_id,
        venue,
        symbol,
        side,
        order_type,
        time_in_force,
        reduce_only,
        client_order_id,
        exchange_order_id,
        status,
        requested_qty,
        requested_price,
        stop_price,
        avg_fill_price,
        filled_qty,
        submitted_at,
        last_exchange_update_at,
        terminal_at,
        raw_exchange_json
      ) values (
        ${order.executionIntentId},
        ${order.tradingAccountId},
        ${order.venue},
        ${order.symbol},
        ${order.side},
        ${order.orderType},
        ${order.timeInForce},
        ${order.reduceOnly},
        ${order.clientOrderId},
        ${order.exchangeOrderId},
        ${order.status},
        ${order.requestedQty},
        ${order.requestedPrice},
        ${order.stopPrice},
        ${order.avgFillPrice},
        ${order.filledQty},
        ${order.submittedAt},
        ${order.lastExchangeUpdateAt},
        ${order.terminalAt},
        ${this.sql.json(order.rawExchangeJson)}
      )
      returning *
    `;

    if (!row) {
      throw new Error("Failed to persist order");
    }

    return mapOrderRow(row);
  }

  async updateOrderStatus(
    orderId: string,
    update: ReceivedOrderStatusUpdate
  ): Promise<StoredOrder> {
    const [row] = await this.sql<OrderRow[]>`
      update orders
      set
        status = ${update.status},
        avg_fill_price = ${update.avgFillPrice},
        filled_qty = ${update.filledQty},
        last_exchange_update_at = ${update.lastExchangeUpdateAt},
        terminal_at = ${update.terminalAt},
        raw_exchange_json = ${this.sql.json(update.rawExchangeJson)}
      where id = ${orderId}
      returning *
    `;

    if (!row) {
      throw new Error("Failed to update order status");
    }

    return mapOrderRow(row);
  }
}

function mapOrderRow(row: OrderRow): StoredOrder {
  return {
    id: row.id,
    executionIntentId: row.execution_intent_id,
    tradingAccountId: row.trading_account_id,
    venue: row.venue,
    symbol: row.symbol,
    side: row.side,
    orderType: row.order_type,
    timeInForce: row.time_in_force,
    reduceOnly: row.reduce_only,
    clientOrderId: row.client_order_id,
    exchangeOrderId: row.exchange_order_id,
    status: row.status,
    requestedQty: row.requested_qty,
    requestedPrice: row.requested_price,
    stopPrice: row.stop_price,
    avgFillPrice: row.avg_fill_price,
    filledQty: row.filled_qty,
    submittedAt: row.submitted_at,
    lastExchangeUpdateAt: row.last_exchange_update_at,
    terminalAt: row.terminal_at,
    rawExchangeJson: row.raw_exchange_json
  };
}

export function createOrderRepositoryFromEnv(): PostgresOrderRepository {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return new PostgresOrderRepository(postgres(databaseUrl));
}
