import { getTradePlanJsonSchema, validateTradePlan } from "@big-banana/contracts";
import type { GeneratedTradePlanResult, TradePlanGenerator } from "@big-banana/domain";
import OpenAI from "openai";
import {
  buildOpenAiTradePlanSystemPrompt,
  buildOpenAiTradePlanUserPrompt
} from "./build-openai-trade-plan-prompt";
import { createOpenAiCompatibleSchema } from "./create-openai-compatible-schema";
import type { OpenAiPlannerConfig } from "./get-openai-planner-config-from-env";

export class MissingOpenAiPlannerApiKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is required when PLANNER_RUNTIME=openai");
    this.name = "MissingOpenAiPlannerApiKeyError";
  }
}

export class InvalidOpenAiTradePlanOutputError extends Error {
  constructor(message = "OpenAI planner output was empty or invalid JSON") {
    super(message);
    this.name = "InvalidOpenAiTradePlanOutputError";
  }
}

export function createOpenAiTradePlanGenerator(
  config: OpenAiPlannerConfig
): TradePlanGenerator {
  if (!config.apiKey) {
    throw new MissingOpenAiPlannerApiKeyError();
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl ?? undefined
  });
  const schema = createOpenAiCompatibleSchema(getTradePlanJsonSchema());

  return async ({ plannerInput, reusablePlan }) => {
    const response = await client.responses.create({
      model: config.model,
      input: [
        {
          role: "system",
          content: buildOpenAiTradePlanSystemPrompt()
        },
        {
          role: "user",
          content: buildOpenAiTradePlanUserPrompt(plannerInput, reusablePlan)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "trade_plan",
          schema,
          strict: true
        }
      }
    } as never);

    const outputText = (response as { output_text?: string }).output_text;

    if (!outputText) {
      throw new InvalidOpenAiTradePlanOutputError("OpenAI planner returned no output_text");
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      throw new InvalidOpenAiTradePlanOutputError();
    }

    if (!validateTradePlan(parsed)) {
      throw new InvalidOpenAiTradePlanOutputError(
        "OpenAI planner output did not satisfy the trade plan schema"
      );
    }

    return {
      tradePlan: parsed,
      tokenUsageJson:
        (response as { usage?: GeneratedTradePlanResult["tokenUsageJson"] }).usage ??
        null
    } as GeneratedTradePlanResult;
  };
}
