import { readFileSync } from "node:fs";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

export const riskVerdictSchemaVersion =
  "https://bitpunk.local/schemas/risk-verdict.schema.json" as const;

export type RiskVerdict = {
  verdict: "approve" | "approve_with_reduction" | "reject";
  approved_risk_pct: number;
  approved_qty: number | null;
  approved_notional: number | null;
  approved_stop_price: number | null;
  require_human_approval: boolean;
  checks: Array<{
    code: string;
    status: "pass" | "fail" | "warn";
    detail: string;
  }>;
  rejection_codes: string[];
};

const schemaUrl = new URL(
  "../../../docs/development/schemas/risk-verdict.schema.json",
  import.meta.url
);
const schema = JSON.parse(readFileSync(schemaUrl, "utf8")) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile<RiskVerdict>(schema);

export function validateRiskVerdict(payload: unknown): payload is RiskVerdict {
  return validate(payload);
}

export function getRiskVerdictValidationErrors(): ErrorObject[] {
  return validate.errors ?? [];
}
