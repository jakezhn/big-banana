import { readFileSync } from "node:fs";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

export const planRevisionSchemaVersion =
  "https://bitpunk.local/schemas/plan-revision.schema.json" as const;

export type PlanRevision = {
  revision_action:
    | "keep"
    | "tighten"
    | "loosen"
    | "downgrade_to_watch"
    | "invalidate"
    | "upgrade"
    | "close_partial"
    | "close_full";
  reason: string;
  changed_fields: string[];
  new_invalidation: {
    condition: string;
    level_reference: string | null;
    timeframe: string | null;
  } | null;
  new_management_rules: string[];
  requires_user_review: boolean;
};

const schemaUrl = new URL(
  "../../../docs/development/schemas/plan-revision.schema.json",
  import.meta.url
);
const schema = JSON.parse(readFileSync(schemaUrl, "utf8")) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile<PlanRevision>(schema);

export function validatePlanRevision(payload: unknown): payload is PlanRevision {
  return validate(payload);
}

export function getPlanRevisionValidationErrors(): ErrorObject[] {
  return validate.errors ?? [];
}

export function getPlanRevisionJsonSchema(): object {
  return schema;
}
