import { describe, expect, it } from "vitest";
import {
  getTradePlanValidationErrors,
  validateTradePlan
} from "../src/trade-plan.js";
import { fixture } from "./helpers.js";

describe("trade-plan.schema.json", () => {
  it("accepts a valid trade plan", () => {
    const payload = fixture("trade-plan.valid.json");

    expect(validateTradePlan(payload)).toBe(true);
  });

  it("rejects skip plans that are not in watch state", () => {
    const payload = fixture("trade-plan.skip-invalid-state.invalid.json");

    expect(validateTradePlan(payload)).toBe(false);
    expect(getTradePlanValidationErrors()).not.toHaveLength(0);
  });
});
