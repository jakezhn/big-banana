import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const contractFixtureDir = resolve(
  testDir,
  "../../contracts/test/fixtures"
);

export function contractFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(resolve(contractFixtureDir, name), "utf8")
  );
}
