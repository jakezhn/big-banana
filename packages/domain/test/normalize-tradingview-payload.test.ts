import { describe, expect, it } from "vitest";
import {
  InvalidTradingViewPayloadError,
  normalizeTradingViewPayload
} from "../src/tradingview/normalize-tradingview-payload.js";
import { contractFixture } from "./helpers.js";

describe("normalizeTradingViewPayload", () => {
  it("normalizes a snapshot payload into a canonical envelope", () => {
    const payload = contractFixture("snapshot.valid.json");
    const envelope = normalizeTradingViewPayload(
      payload,
      "2026-05-17T10:00:00.000Z"
    );

    expect(envelope).toMatchObject({
      source: "tradingview",
      sourceSchemaVersion: "bitpunk.webhook.v12",
      internalSchemaVersion: "core.alert.v1",
      type: "snapshot",
      marketKey: "BINANCE:BTCUSDT:240",
      eventKey: "BINANCE:BTCUSDT:240:1778419200000:snapshot",
      barTimeMs: 1778419200000,
      receivedAt: "2026-05-17T10:00:00.000Z"
    });
    expect(envelope).not.toHaveProperty("signal");
  });

  it("preserves signal detail for signal payloads", () => {
    const payload = contractFixture("signal.valid.json");
    const envelope = normalizeTradingViewPayload(
      payload,
      "2026-05-17T10:00:00.000Z"
    );

    expect(envelope.type).toBe("signal");
    expect(envelope.eventKey).toBe(
      "BINANCE:BTCUSDT:240:1778404800000:signal"
    );
    expect(envelope.signal).toMatchObject({
      direction: "long",
      rank_level: 4,
      regime_alignement: "align"
    });
  });

  it.each([
    "unknown-version.invalid.json",
    "signal.missing-signal.invalid.json",
    "snapshot.with-signal.invalid.json"
  ])("rejects invalid payload fixture %s", (name) => {
    expect(() => normalizeTradingViewPayload(contractFixture(name))).toThrow(
      InvalidTradingViewPayloadError
    );
  });
});
