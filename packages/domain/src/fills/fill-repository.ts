import type { StoredOrder } from "../orders/order-repository";

export type ReceivedFill = {
  orderId: string;
  executionIntentId: string;
  tradingAccountId: string;
  venue: string;
  symbol: string;
  side: StoredOrder["side"];
  qty: number;
  price: number;
  filledAt: string;
  exchangeFillId: string;
  rawExchangeJson: StoredOrder["rawExchangeJson"];
};

export type StoredFill = ReceivedFill & {
  id: string;
};

export interface FillRepository {
  recordFill(fill: ReceivedFill): Promise<StoredFill>;

  getLatestFillByOrderId(orderId: string): Promise<StoredFill | null>;
}
