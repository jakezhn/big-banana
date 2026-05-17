export const planStates = [
  "watch",
  "armed",
  "pending_entry",
  "entered",
  "managing",
  "exit_only",
  "closed",
  "invalidated",
  "expired"
] as const;

export type PlanState = (typeof planStates)[number];

const planTransitions: Record<PlanState, PlanState[]> = {
  watch: ["armed", "expired"],
  armed: ["pending_entry", "expired"],
  pending_entry: ["entered", "expired"],
  entered: ["managing"],
  managing: ["exit_only", "invalidated"],
  exit_only: ["closed"],
  closed: [],
  invalidated: ["closed"],
  expired: []
};

export class InvalidPlanStateTransitionError extends Error {
  constructor(
    readonly from: PlanState,
    readonly to: PlanState
  ) {
    super(`Invalid plan state transition: ${from} -> ${to}`);
    this.name = "InvalidPlanStateTransitionError";
  }
}

export function canTransitionPlanState(
  from: PlanState,
  to: PlanState
): boolean {
  return planTransitions[from].includes(to);
}

export function assertPlanStateTransition(
  from: PlanState,
  to: PlanState
): void {
  if (!canTransitionPlanState(from, to)) {
    throw new InvalidPlanStateTransitionError(from, to);
  }
}
