import type { FillRepository, StoredFill } from "../fills/fill-repository";
import { applyFillToPosition } from "../positions/apply-fill-to-position";
import type {
  PositionRepository,
  PositionUpdateFromFillResult
} from "../positions/position-repository";
import {
  reconcilePaperOrder,
  type PaperReconcileOutcome
} from "./reconcile-paper-order";
import type { OrderRepository, StoredOrder } from "./order-repository";

export type ReconcilePaperOrderAndRecordFillResult = {
  order: StoredOrder;
  fill: StoredFill | null;
  positionUpdate: PositionUpdateFromFillResult | null;
};

export async function reconcilePaperOrderAndRecordFill(
  marketKey: string,
  order: StoredOrder,
  outcome: PaperReconcileOutcome,
  orderRepository: OrderRepository,
  fillRepository: FillRepository,
  positionRepository: PositionRepository,
  reconciledAt = new Date().toISOString()
): Promise<ReconcilePaperOrderAndRecordFillResult> {
  const updatedOrder = await reconcilePaperOrder(
    order,
    outcome,
    orderRepository,
    reconciledAt
  );

  if (outcome !== "filled") {
    return {
      order: updatedOrder,
      fill: null,
      positionUpdate: null
    };
  }

  const fill = await fillRepository.recordFill({
    orderId: updatedOrder.id,
    executionIntentId: updatedOrder.executionIntentId,
    tradingAccountId: updatedOrder.tradingAccountId,
    venue: updatedOrder.venue,
    symbol: updatedOrder.symbol,
    side: updatedOrder.side,
    qty: updatedOrder.filledQty,
    price: updatedOrder.avgFillPrice ?? updatedOrder.requestedPrice ?? 0,
    filledAt: reconciledAt,
    exchangeFillId: `${updatedOrder.venue}:${updatedOrder.id}:${reconciledAt}`,
    rawExchangeJson: updatedOrder.rawExchangeJson
  });

  const positionUpdate = await applyFillToPosition(
    { marketKey, fill },
    positionRepository
  );

  return {
    order: updatedOrder,
    fill,
    positionUpdate
  };
}
