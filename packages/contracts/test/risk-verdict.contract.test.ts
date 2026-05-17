import { describe, expect, it } from "vitest";
import {
  getRiskVerdictValidationErrors,
  validateRiskVerdict
} from "../src/risk-verdict.js";
import { fixture } from "./helpers.js";

describe("risk-verdict.schema.json", () => {
  it("accepts a valid risk verdict", () => {
    const payload = fixture("risk-verdict.valid.json");

    expect(validateRiskVerdict(payload)).toBe(true);
  });

  it("rejects checks without required detail", () => {
    const payload = fixture(
      "risk-verdict.missing-check-detail.invalid.json"
    );

    expect(validateRiskVerdict(payload)).toBe(false);
    expect(getRiskVerdictValidationErrors()).not.toHaveLength(0);
  });
});
