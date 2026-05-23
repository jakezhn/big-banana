import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOpenAiCompatibleSchema } from "../../src/planner/create-openai-compatible-schema";

describe("createOpenAiCompatibleSchema", () => {
  it("removes unsupported composition keywords from the model-facing schema", () => {
    const schema = JSON.parse(
      readFileSync(
        new URL(
          "../../../../docs/development/schemas/trade-plan.schema.json",
          import.meta.url
        ),
        "utf8"
      )
    ) as object;

    const result = createOpenAiCompatibleSchema(schema);

    expect(result).not.toHaveProperty("$schema");
    expect(result).not.toHaveProperty("$id");
    expect(result).not.toHaveProperty("allOf");
    expect(JSON.stringify(result)).not.toContain("\"if\"");
    expect(JSON.stringify(result)).not.toContain("\"then\"");
    expect(result).toMatchObject({
      type: "object",
      properties: {
        action: {
          enum: ["create", "keep", "patch", "terminate", "skip"]
        }
      }
    });
  });
});
