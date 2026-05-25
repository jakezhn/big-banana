import { readFileSync } from "node:fs";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

export const postPlanReviewSchemaVersion =
  "https://bitpunk.local/schemas/post-plan-review.schema.json" as const;

export type PostPlanReview = {
  outcome_summary: string;
  what_worked: string[];
  what_failed: string[];
  missed_context: string[];
  early_warning_signals: string[];
  lesson_candidates: string[];
  should_update_strategy_memory: boolean;
};

const schemaUrl = new URL(
  "../../../docs/development/schemas/post-plan-review.schema.json",
  import.meta.url
);
const schema = JSON.parse(readFileSync(schemaUrl, "utf8")) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile<PostPlanReview>(schema);

export function validatePostPlanReview(
  payload: unknown
): payload is PostPlanReview {
  return validate(payload);
}

export function getPostPlanReviewValidationErrors(): ErrorObject[] {
  return validate.errors ?? [];
}

export function getPostPlanReviewJsonSchema(): object {
  return schema;
}
