export const orderStates = [
  "drafted",
  "preflight_failed",
  "approved",
  "submitted",
  "acked",
  "submit_unknown",
  "rejected",
  "partially_filled",
  "filled",
  "canceled",
  "reconciled_open",
  "reconciled_absent"
] as const;

export type OrderState = (typeof orderStates)[number];

const orderTransitions: Record<OrderState, OrderState[]> = {
  drafted: ["preflight_failed", "approved"],
  preflight_failed: [],
  approved: ["submitted"],
  submitted: ["acked", "submit_unknown", "rejected"],
  acked: ["partially_filled", "filled", "canceled"],
  submit_unknown: ["reconciled_open", "reconciled_absent"],
  rejected: [],
  partially_filled: ["filled", "canceled"],
  filled: [],
  canceled: [],
  reconciled_open: ["acked"],
  reconciled_absent: ["rejected"]
};

export class InvalidOrderStateTransitionError extends Error {
  constructor(
    readonly from: OrderState,
    readonly to: OrderState
  ) {
    super(`Invalid order state transition: ${from} -> ${to}`);
    this.name = "InvalidOrderStateTransitionError";
  }
}

export function canTransitionOrderState(
  from: OrderState,
  to: OrderState
): boolean {
  return orderTransitions[from].includes(to);
}

export function assertOrderStateTransition(
  from: OrderState,
  to: OrderState
): void {
  if (!canTransitionOrderState(from, to)) {
    throw new InvalidOrderStateTransitionError(from, to);
  }
}
