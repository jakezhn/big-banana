import {
  assertOrderStateTransition,
  type OrderState
} from "../state-machines/order-state-machine";
import type {
  OrderRepository,
  ReceivedOrderStatusUpdate,
  StoredOrder
} from "./order-repository";

export type PaperReconcileOutcome = "filled" | "canceled";

export class UnsupportedPaperReconcileOutcomeError extends Error {
  constructor(outcome: string) {
    super(`Unsupported paper reconcile outcome: ${outcome}`);
    this.name = "UnsupportedPaperReconcileOutcomeError";
  }
}

export async function reconcilePaperOrder(
  order: StoredOrder,
  outcome: PaperReconcileOutcome,
  repository: OrderRepository,
  reconciledAt = new Date().toISOString()
): Promise<StoredOrder> {
  const nextState = mapOutcomeToState(outcome);
  assertOrderStateTransition(order.status, nextState);

  const update: ReceivedOrderStatusUpdate =
    nextState === "filled"
      ? {
          status: nextState,
          avgFillPrice: order.requestedPrice,
          filledQty: order.requestedQty,
          lastExchangeUpdateAt: reconciledAt,
          terminalAt: reconciledAt,
          rawExchangeJson: {
            ...asObject(order.rawExchangeJson),
            reconcile: "paper_stub",
            outcome
          }
        }
      : {
          status: nextState,
          avgFillPrice: order.avgFillPrice,
          filledQty: order.filledQty,
          lastExchangeUpdateAt: reconciledAt,
          terminalAt: reconciledAt,
          rawExchangeJson: {
            ...asObject(order.rawExchangeJson),
            reconcile: "paper_stub",
            outcome
          }
        };

  return repository.updateOrderStatus(order.id, update);
}

function mapOutcomeToState(outcome: string): OrderState {
  if (outcome === "filled" || outcome === "canceled") {
    return outcome;
  }

  throw new UnsupportedPaperReconcileOutcomeError(outcome);
}

function asObject(
  value: StoredOrder["rawExchangeJson"]
): Record<string, StoredOrder["rawExchangeJson"]> | Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}
