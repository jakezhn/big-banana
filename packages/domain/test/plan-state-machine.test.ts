import { describe, expect, it } from "vitest";
import {
  assertPlanStateTransition,
  canTransitionPlanState,
  InvalidPlanStateTransitionError,
  type PlanState
} from "../src/index.js";

describe("plan state machine", () => {
  it("allows frozen phase 0 transitions", () => {
    const transitions: Array<[PlanState, PlanState]> = [
      ["watch", "armed"],
      ["watch", "expired"],
      ["armed", "pending_entry"],
      ["armed", "expired"],
      ["pending_entry", "entered"],
      ["pending_entry", "expired"],
      ["entered", "managing"],
      ["managing", "exit_only"],
      ["managing", "invalidated"],
      ["exit_only", "closed"],
      ["invalidated", "closed"]
    ];

    for (const [from, to] of transitions) {
      expect(canTransitionPlanState(from, to)).toBe(true);
      expect(() => assertPlanStateTransition(from, to)).not.toThrow();
    }
  });

  it("rejects invalid transitions", () => {
    expect(canTransitionPlanState("watch", "entered")).toBe(false);
    expect(() => assertPlanStateTransition("closed", "watch")).toThrow(
      InvalidPlanStateTransitionError
    );
  });
});
