import {
  getMemoryLessonCandidatesJsonSchema,
  validateMemoryLessonCandidates
} from "@big-banana/contracts";
import type {
  GeneratedMemoryLessonCandidatesResult,
  MemoryLessonCandidateGenerator
} from "@big-banana/domain";
import OpenAI from "openai";
import type { OpenAiPlannerConfig } from "../planner/get-openai-planner-config-from-env";
import type { HermesMarketRole } from "../planner/get-hermes-market-role";
import { createOpenAiCompatibleSchema } from "../planner/create-openai-compatible-schema";
import {
  buildOpenAiMemoryLessonCandidatesSystemPrompt,
  buildOpenAiMemoryLessonCandidatesUserPrompt
} from "./build-openai-memory-lesson-candidates-prompt";

export class InvalidOpenAiMemoryLessonCandidatesOutputError extends Error {
  constructor(
    message = "OpenAI memory lesson candidates output was empty or invalid JSON"
  ) {
    super(message);
    this.name = "InvalidOpenAiMemoryLessonCandidatesOutputError";
  }
}

export function createOpenAiMemoryLessonCandidatesGenerator(
  config: OpenAiPlannerConfig,
  options: { marketRole?: HermesMarketRole } = {}
): MemoryLessonCandidateGenerator {
  if (!config.apiKey) {
    throw new Error("OPENAI_API_KEY is required when PLANNER_RUNTIME=openai");
  }

  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl ?? undefined
  });
  const schema = createOpenAiCompatibleSchema(getMemoryLessonCandidatesJsonSchema());

  return async ({ review, pipeline }) => {
    const response = await client.responses.create({
      model: config.model,
      input: [
        {
          role: "system",
          content: buildOpenAiMemoryLessonCandidatesSystemPrompt(options.marketRole)
        },
        {
          role: "user",
          content: buildOpenAiMemoryLessonCandidatesUserPrompt(
            review,
            pipeline,
            options.marketRole
          )
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "memory_lesson_candidates",
          schema,
          strict: true
        }
      }
    } as never);

    const outputText = (response as { output_text?: string }).output_text;

    if (!outputText) {
      throw new InvalidOpenAiMemoryLessonCandidatesOutputError(
        "OpenAI memory lesson candidates returned no output_text"
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(outputText);
    } catch {
      throw new InvalidOpenAiMemoryLessonCandidatesOutputError();
    }

    if (!validateMemoryLessonCandidates(parsed)) {
      throw new InvalidOpenAiMemoryLessonCandidatesOutputError(
        "OpenAI memory lesson candidates output did not satisfy the schema"
      );
    }

    return {
      memoryLessonCandidates: parsed,
      tokenUsageJson:
        (response as {
          usage?: GeneratedMemoryLessonCandidatesResult["tokenUsageJson"];
        }).usage ?? null
    } as GeneratedMemoryLessonCandidatesResult;
  };
}
