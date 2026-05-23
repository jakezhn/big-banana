type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

const UNSUPPORTED_KEYS = new Set([
  "$schema",
  "$id",
  "allOf",
  "anyOf",
  "oneOf",
  "if",
  "then",
  "else",
  "dependentSchemas",
  "unevaluatedProperties",
  "unevaluatedItems"
]);

export function createOpenAiCompatibleSchema(schema: object): object {
  return sanitize(schema) as object;
}

function sanitize(value: unknown): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitize(entry));
  }

  if (value && typeof value === "object") {
    const next: { [key: string]: JsonValue } = {};

    for (const [key, child] of Object.entries(value)) {
      if (UNSUPPORTED_KEYS.has(key)) {
        continue;
      }

      next[key] = sanitize(child);
    }

    return next;
  }

  return (value ?? null) as JsonValue;
}
