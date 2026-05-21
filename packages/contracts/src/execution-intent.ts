import { readFileSync } from "node:fs";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

export const executionIntentSchemaVersion =
  "https://bitpunk.local/schemas/execution-intent.schema.json" as const;

export type ExecutionIntent = {
  action: "open" | "amend" | "cancel" | "reduce" | "close";
  plan_version_id: string;
  trading_account_id: string;
  symbol: string;
  side: "buy" | "sell";
  order_type: "limit" | "market" | "conditional";
  time_in_force: "GTC" | "IOC" | "FOK" | "PostOnly";
  qty: number;
  price: number | null;
  stop_price: number | null;
  reduce_only: boolean;
  client_order_id: string;
  idempotency_key: string;
};

const schemaUrl = new URL(
  "../../../docs/development/schemas/execution-intent.schema.json",
  import.meta.url
);
const schema = JSON.parse(readFileSync(schemaUrl, "utf8")) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile<ExecutionIntent>(schema);

export function validateExecutionIntent(
  payload: unknown
): payload is ExecutionIntent {
  return validate(payload);
}

export function getExecutionIntentValidationErrors(): ErrorObject[] {
  return validate.errors ?? [];
}
