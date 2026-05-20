import type { ExecutionIntent } from "@big-banana/contracts";
import type { OrderState } from "../state-machines/order-state-machine";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export type ReceivedOrder = {
  executionIntentId: string;
  tradingAccountId: string;
  venue: string;
  symbol: string;
  side: ExecutionIntent["side"];
  orderType: ExecutionIntent["order_type"];
  timeInForce: ExecutionIntent["time_in_force"];
  reduceOnly: boolean;
  clientOrderId: string;
  exchangeOrderId: string | null;
  status: OrderState;
  requestedQty: number;
  requestedPrice: number | null;
  stopPrice: number | null;
  avgFillPrice: number | null;
  filledQty: number;
  submittedAt: string;
  lastExchangeUpdateAt: string;
  terminalAt: string | null;
  rawExchangeJson: JsonValue;
};

export type StoredOrder = ReceivedOrder & {
  id: string;
};

export type ReceivedOrderStatusUpdate = {
  status: OrderState;
  avgFillPrice: number | null;
  filledQty: number;
  lastExchangeUpdateAt: string;
  terminalAt: string | null;
  rawExchangeJson: JsonValue;
};

export interface OrderRepository {
  getLatestOrderByExecutionIntentId(
    executionIntentId: string
  ): Promise<StoredOrder | null>;

  recordOrder(order: ReceivedOrder): Promise<StoredOrder>;

  updateOrderStatus(
    orderId: string,
    update: ReceivedOrderStatusUpdate
  ): Promise<StoredOrder>;
}
