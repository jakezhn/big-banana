import { describe, expect, it } from "vitest";
import {
  formatEligible,
  formatLatestTimestamp,
  formatNullableNumber,
  formatTokenUsage,
  shortenId,
  truncate
} from "../src/ui/format";

describe("dashboard formatters", () => {
  it("formats missing values consistently", () => {
    expect(formatNullableNumber(null)).toBe("-");
    expect(formatNullableNumber(undefined)).toBe("-");
    expect(formatEligible(null)).toBe("-");
  });

  it("formats recorded token usage", () => {
    expect(formatTokenUsage({ total_tokens: 12345 })).toBe("12,345 tokens");
    expect(formatTokenUsage({ prompt_tokens: 10 })).toBe("usage recorded");
    expect(formatTokenUsage(null)).toBe("usage unavailable");
  });

  it("formats the latest timestamp from sparse values", () => {
    expect(
      formatLatestTimestamp([
        null,
        "2026-05-24T10:00:00.000Z",
        undefined,
        "2026-05-25T09:30:00.000Z",
        "not-a-date"
      ])
    ).toContain("05/25/2026");
    expect(formatLatestTimestamp([null, undefined, "not-a-date"])).toBe("-");
  });

  it("shortens long operational identifiers and text", () => {
    expect(shortenId("1234567890abcdef")).toBe("12345678...cdef");
    expect(truncate("pipeline execution failed", 12)).toBe("pipeline ...");
  });
});
