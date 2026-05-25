import {
  getPostPlanReviewJsonSchema,
  validatePostPlanReview
} from "@big-banana/contracts";
import type {
  GeneratedPostPlanReviewResult,
  PostPlanReviewGenerator
} from "@big-banana/domain";
import OpenAI from "openai";
import type { OpenAiPlannerConfig } from "../planner/get-openai-planner-config-from-env";
import type { HermesMarketRole } from "../planner/get-hermes-market-role";
import { createOpenAiCompatibleSchema } from "../planner/create-openai-compatible-schema";
import {
  buildOpenAiPostPlanReviewSystemPrompt,
  buildOpenAiPostPlanReviewUserPrompt
} from "./build-openai-post-plan-review-prompt";

export class InvalidOpenAiPostPlanReviewOutputError extends Error {
  constructor(message = "OpenAI post-plan review output was empty or invalid JSON") {
    super(message);
    this.name = "InvalidOpenAiPostPlanReviewOutputError";
  }
}

export function createOpenAiPostPlanReviewGenerator(
  config: OpenAiPlannerConfig,
  options: { marketRole?: HermesMarketRole } = {}
): PostPlanReviewGenerator {
  if (!config.apiKey) {
    throw new Error("OPENAI_API_KEY is required when PLANNER_RUNTIME=openai");
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl ?? undefined
  });
  const schema = createOpenAiCompatibleSchema(getPostPlanReviewJsonSchema());

  return async ({ pipeline }) => {
    const response = await client.responses.create({
      model: config.model,
      input: [
        {
          role: "system",
          content: buildOpenAiPostPlanReviewSystemPrompt(options.marketRole)
        },
        {
          role: "user",
          content: buildOpenAiPostPlanReviewUserPrompt(pipeline, options.marketRole)
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "post_plan_review",
          schema,
          strict: true
        }
      }
    } as never);

    const outputText = (response as { output_text?: string }).output_text;

    if (!outputText) {
      throw new InvalidOpenAiPostPlanReviewOutputError(
        "OpenAI post-plan review returned no output_text"
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      throw new InvalidOpenAiPostPlanReviewOutputError();
    }

    if (!validatePostPlanReview(parsed)) {
      throw new InvalidOpenAiPostPlanReviewOutputError(
        "OpenAI post-plan review output did not satisfy the post-plan review schema"
      );
    }

    return {
      postPlanReview: parsed,
      tokenUsageJson:
        (response as { usage?: GeneratedPostPlanReviewResult["tokenUsageJson"] }).usage ??
        null
    } as GeneratedPostPlanReviewResult;
  };
}
