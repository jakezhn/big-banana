import { randomUUID } from "node:crypto";
import type { StoredExecutionIntent } from "../execution/execution-intent-repository";
import type { OrderRepository, StoredOrder } from "./order-repository";
import { assertOrderStateTransition } from "../state-machines/order-state-machine";

export async function submitPaperOrderFromExecutionIntent(
  executionIntent: StoredExecutionIntent,
  repository: OrderRepository,
  submittedAt = new Date().toISOString()
): Promise<StoredOrder> {
  assertOrderStateTransition("drafted", "approved");
  assertOrderStateTransition("approved", "submitted");
  assertOrderStateTransition("submitted", "acked");

  return repository.recordOrder({
    executionIntentId: executionIntent.id,
    tradingAccountId: executionIntent.tradingAccountId,
    venue: "paper",
    symbol: executionIntent.payload.symbol,
    side: executionIntent.payload.side,
    orderType: executionIntent.payload.order_type,
    timeInForce: executionIntent.payload.time_in_force,
    reduceOnly: executionIntent.payload.reduce_only,
    clientOrderId: executionIntent.payload.client_order_id,
    exchangeOrderId: buildPaperExchangeOrderId(),
    status: "acked",
    requestedQty: executionIntent.payload.qty,
    requestedPrice: executionIntent.payload.price,
    stopPrice: executionIntent.payload.stop_price,
    avgFillPrice: null,
    filledQty: 0,
    submittedAt,
    lastExchangeUpdateAt: submittedAt,
    terminalAt: null,
    rawExchangeJson: {
      mode: "paper",
      submission: "stub",
      acknowledged: true
    }
  });
}

function buildPaperExchangeOrderId(): string {
  return `paper-${randomUUID()}`;
}
