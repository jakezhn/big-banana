import { describe, expect, it } from "vitest";
import {
  getMemoryLessonCandidatesValidationErrors,
  validateMemoryLessonCandidates
} from "../src/memory-lesson-candidates.js";
import { fixture } from "./helpers.js";

describe("memory-lesson-candidates.schema.json", () => {
  it("accepts valid memory lesson candidates", () => {
    const payload = fixture("memory-lesson-candidates.valid.json");

    expect(validateMemoryLessonCandidates(payload)).toBe(true);
  });

  it("rejects lesson candidates without scope", () => {
    const payload = fixture("memory-lesson-candidates.invalid-missing-scope.json");

    expect(validateMemoryLessonCandidates(payload)).toBe(false);
    expect(getMemoryLessonCandidatesValidationErrors()).not.toHaveLength(0);
  });
});
