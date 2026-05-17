import { describe, expect, it } from "vitest";
import {
  getExecutionIntentValidationErrors,
  validateExecutionIntent
} from "../src/execution-intent.js";
import { fixture } from "./helpers.js";

describe("execution-intent.schema.json", () => {
  it("accepts a valid execution intent", () => {
    const payload = fixture("execution-intent.valid.json");

    expect(validateExecutionIntent(payload)).toBe(true);
  });

  it("rejects reduce actions that are not reduce-only", () => {
    const payload = fixture(
      "execution-intent.reduce-without-reduce-only.invalid.json"
    );

    expect(validateExecutionIntent(payload)).toBe(false);
    expect(getExecutionIntentValidationErrors()).not.toHaveLength(0);
  });
});
