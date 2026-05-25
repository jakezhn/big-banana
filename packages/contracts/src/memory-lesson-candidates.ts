import { readFileSync } from "node:fs";
import { Ajv2020, type ErrorObject } from "ajv/dist/2020.js";

export const memoryLessonCandidatesSchemaVersion =
  "https://bitpunk.local/schemas/memory-lesson-candidates.schema.json" as const;

export type MemoryLessonCandidateItem = {
  lesson: string;
  scope: {
    market: string;
    asset_class: string | null;
    symbol: string | null;
    timeframe: string | null;
    regime: string | null;
    signal_type: string | null;
  };
  confidence: number;
  sample_size: number;
  decay_days: number;
  retrieval_hint: string;
};

export type MemoryLessonCandidates = {
  memory_items: MemoryLessonCandidateItem[];
  reject_reasons: string[];
};

const schemaUrl = new URL(
  "../../../docs/development/schemas/memory-lesson-candidates.schema.json",
  import.meta.url
);
const schema = JSON.parse(readFileSync(schemaUrl, "utf8")) as object;
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile<MemoryLessonCandidates>(schema);

export function validateMemoryLessonCandidates(
  payload: unknown
): payload is MemoryLessonCandidates {
  return validate(payload);
}

export function getMemoryLessonCandidatesValidationErrors(): ErrorObject[] {
  return validate.errors ?? [];
}

export function getMemoryLessonCandidatesJsonSchema(): object {
  return schema;
}
