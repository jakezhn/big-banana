import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv2020, type AnySchema } from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";
import { fixture } from "./helpers.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageDir = resolve(testDir, "..");
const repoRoot = resolve(packageDir, "../..");

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

const implementationSchema = readJson(
  resolve(packageDir, "schemas/webhook-payload-v12.schema.json"),
) as AnySchema;
const frozenDesignSchema = readJson(
  resolve(repoRoot, "docs/development/schemas/webhook-payload-v12.schema.json"),
);

const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(implementationSchema);

describe("webhook-payload-v12 contract", () => {
  it("keeps the runtime schema aligned with the frozen design schema", () => {
    expect(implementationSchema).toEqual(frozenDesignSchema);
  });

  it("accepts a valid snapshot payload", () => {
    expect(validate(fixture("snapshot.valid.json"))).toBe(true);
  });

  it("accepts a valid signal payload", () => {
    expect(validate(fixture("signal.valid.json"))).toBe(true);
  });

  it.each([
    "signal.missing-signal.invalid.json",
    "snapshot.with-signal.invalid.json",
    "unknown-version.invalid.json",
    "signal.invalid-direction.invalid.json",
    "snapshot.extra-field.invalid.json"
  ])("rejects invalid fixture %s", (name) => {
    expect(validate(fixture(name))).toBe(false);
  });
});
