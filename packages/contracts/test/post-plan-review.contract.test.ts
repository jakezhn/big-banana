import { describe, expect, it } from "vitest";
import {
  getPostPlanReviewValidationErrors,
  validatePostPlanReview
} from "../src/post-plan-review.js";
import { fixture } from "./helpers.js";

describe("post-plan-review.schema.json", () => {
  it("accepts a valid post-plan review", () => {
    const payload = fixture("post-plan-review.valid.json");

    expect(validatePostPlanReview(payload)).toBe(true);
  });

  it("rejects reviews without an outcome summary", () => {
    const payload = fixture("post-plan-review.invalid-missing-summary.json");

    expect(validatePostPlanReview(payload)).toBe(false);
    expect(getPostPlanReviewValidationErrors()).not.toHaveLength(0);
  });
});
