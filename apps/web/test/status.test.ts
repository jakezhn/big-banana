import { describe, expect, it } from "vitest";
import { getStatusTone } from "../src/ui/status";

describe("status tone mapping", () => {
  it("maps known terminal and failure statuses", () => {
    expect(getStatusTone("success")).toBe("good");
    expect(getStatusTone("order_terminal")).toBe("good");
    expect(getStatusTone("failed")).toBe("bad");
    expect(getStatusTone("risk_rejected")).toBe("bad");
  });

  it("maps active pipeline statuses and falls back safely", () => {
    expect(getStatusTone("order_submitted")).toBe("accent");
    expect(getStatusTone("plan_ready")).toBe("warn");
    expect(getStatusTone("unknown_new_status")).toBe("neutral");
  });
});
