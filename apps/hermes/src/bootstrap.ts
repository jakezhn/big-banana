import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";

loadEnv({
  path: resolve(process.cwd(), ".env.local"),
  override: false
});

loadEnv({
  path: resolve(process.cwd(), ".env"),
  override: false
});

await import("./main");
