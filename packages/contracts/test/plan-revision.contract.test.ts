import { describe, expect, it } from "vitest";
import {
  getPlanRevisionValidationErrors,
  validatePlanRevision
} from "../src/plan-revision.js";
import { fixture } from "./helpers.js";

describe("plan-revision.schema.json", () => {
  it("accepts a valid plan revision suggestion", () => {
    const payload = fixture("plan-revision.valid.json");

    expect(validatePlanRevision(payload)).toBe(true);
  });

  it("rejects revisions without a reason", () => {
    const payload = fixture("plan-revision.invalid-missing-reason.json");

    expect(validatePlanRevision(payload)).toBe(false);
    expect(getPlanRevisionValidationErrors()).not.toHaveLength(0);
  });
});
