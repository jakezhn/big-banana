import {
  getPlanRevisionJsonSchema,
  validatePlanRevision
} from "@big-banana/contracts";
import type {
  GeneratedPlanRevisionResult,
  PlanRevisionGenerator
} from "@big-banana/domain";
import OpenAI from "openai";
import {
  buildOpenAiPlanRevisionSystemPrompt,
  buildOpenAiPlanRevisionUserPrompt
} from "./build-openai-plan-revision-prompt";
import { createOpenAiCompatibleSchema } from "../planner/create-openai-compatible-schema";
import type { OpenAiPlannerConfig } from "../planner/get-openai-planner-config-from-env";
import type { HermesMarketRole } from "../planner/get-hermes-market-role";

export class InvalidOpenAiPlanRevisionOutputError extends Error {
  constructor(message = "OpenAI plan revision output was empty or invalid JSON") {
    super(message);
    this.name = "InvalidOpenAiPlanRevisionOutputError";
  }
}

export function createOpenAiPlanRevisionGenerator(
  config: OpenAiPlannerConfig,
  options: { marketRole?: HermesMarketRole } = {}
): PlanRevisionGenerator {
  if (!config.apiKey) {
    throw new Error("OPENAI_API_KEY is required when PLANNER_RUNTIME=openai");
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl ?? undefined
  });
  const schema = createOpenAiCompatibleSchema(getPlanRevisionJsonSchema());

  return async ({ plannerInput, activePlan }) => {
    const response = await client.responses.create({
      model: config.model,
      input: [
        {
          role: "system",
          content: buildOpenAiPlanRevisionSystemPrompt(options.marketRole)
        },
        {
          role: "user",
          content: buildOpenAiPlanRevisionUserPrompt(
            plannerInput,
            activePlan,
            options.marketRole
          )
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "plan_revision",
          schema,
          strict: true
        }
      }
    } as never);

    const outputText = (response as { output_text?: string }).output_text;

    if (!outputText) {
      throw new InvalidOpenAiPlanRevisionOutputError(
        "OpenAI plan revision returned no output_text"
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      throw new InvalidOpenAiPlanRevisionOutputError();
    }

    if (!validatePlanRevision(parsed)) {
      throw new InvalidOpenAiPlanRevisionOutputError(
        "OpenAI plan revision output did not satisfy the plan revision schema"
      );
    }

    return {
      planRevision: parsed,
      tokenUsageJson:
        (response as { usage?: GeneratedPlanRevisionResult["tokenUsageJson"] }).usage ??
        null
    } as GeneratedPlanRevisionResult;
  };
}
