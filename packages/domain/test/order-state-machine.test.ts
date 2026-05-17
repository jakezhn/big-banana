import { describe, expect, it } from "vitest";
import {
  assertOrderStateTransition,
  canTransitionOrderState,
  InvalidOrderStateTransitionError,
  type OrderState
} from "../src/index.js";

describe("order state machine", () => {
  it("allows frozen phase 0 transitions", () => {
    const transitions: Array<[OrderState, OrderState]> = [
      ["drafted", "preflight_failed"],
      ["drafted", "approved"],
      ["approved", "submitted"],
      ["submitted", "acked"],
      ["submitted", "submit_unknown"],
      ["submitted", "rejected"],
      ["acked", "partially_filled"],
      ["acked", "filled"],
      ["acked", "canceled"],
      ["partially_filled", "filled"],
      ["partially_filled", "canceled"],
      ["submit_unknown", "reconciled_open"],
      ["submit_unknown", "reconciled_absent"],
      ["reconciled_open", "acked"],
      ["reconciled_absent", "rejected"]
    ];

    for (const [from, to] of transitions) {
      expect(canTransitionOrderState(from, to)).toBe(true);
      expect(() => assertOrderStateTransition(from, to)).not.toThrow();
    }
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionOrderState("drafted", "filled")).toBe(false);
    expect(() => assertOrderStateTransition("filled", "submitted")).toThrow(
      InvalidOrderStateTransitionError
    );
  });
});
