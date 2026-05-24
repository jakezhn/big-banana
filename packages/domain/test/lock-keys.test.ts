import { describe, expect, it } from "vitest";
import {
  buildExecutionLockKey,
  buildPlanLockKey,
  buildRiskLockKey,
  buildSymbolLockKey
} from "../src/index.js";

describe("agent lock keys", () => {
  it("builds a symbol lock key with market and symbol scope", () => {
    expect(buildSymbolLockKey("crypto", "BTCUSDT")).toBe("symbol:crypto:BTCUSDT");
  });

  it("builds a plan lock key", () => {
    expect(buildPlanLockKey("plan-123")).toBe("plan:plan-123");
  });

  it("builds an account risk lock key", () => {
    expect(buildRiskLockKey("acct-1")).toBe("risk:acct-1");
  });

  it("builds an account execution lock key", () => {
    expect(buildExecutionLockKey("acct-1")).toBe("execution:acct-1");
  });
});
