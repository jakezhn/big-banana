import {
  generateDeterministicMemoryLessonCandidates,
  type MemoryLessonCandidateGenerator,
  type PlannerRunnerInfo
} from "@big-banana/domain";
import type { AgentJobMarket } from "@big-banana/domain";
import {
  getHermesMarketRole,
  type HermesMarketRoleId
} from "../planner/get-hermes-market-role";
import { getOpenAiPlannerConfigFromEnv } from "../planner/get-openai-planner-config-from-env";
import {
  getPlannerRuntimeFromEnv,
  type PlannerRuntime
} from "../planner/get-planner-runtime-from-env";
import { createOpenAiMemoryLessonCandidatesGenerator } from "./create-openai-memory-lesson-candidates-generator";
import { OPENAI_MEMORY_LESSON_CANDIDATES_PROMPT_VERSION } from "./build-openai-memory-lesson-candidates-prompt";

export type ConfiguredMemoryLessonCandidatesGenerator = {
  runtime: PlannerRuntime;
  marketRole: HermesMarketRoleId;
  runner: PlannerRunnerInfo;
  generator: MemoryLessonCandidateGenerator;
};

export function createMemoryLessonCandidatesGeneratorFromEnv(
  env: NodeJS.ProcessEnv = process.env,
  options: {
    market?: AgentJobMarket | null;
  } = {}
): ConfiguredMemoryLessonCandidatesGenerator {
  const runtime = getPlannerRuntimeFromEnv(env);
  const marketRole = getHermesMarketRole(options.market);
  const skillName = marketRole.promptVersionSuffix
    ? `curate_memory_lesson_candidates.${marketRole.promptVersionSuffix}`
    : "curate_memory_lesson_candidates";

  if (runtime === "openai") {
    const config = getOpenAiPlannerConfigFromEnv(env);
    const promptVersion = marketRole.promptVersionSuffix
      ? `${OPENAI_MEMORY_LESSON_CANDIDATES_PROMPT_VERSION}:${marketRole.promptVersionSuffix}`
      : OPENAI_MEMORY_LESSON_CANDIDATES_PROMPT_VERSION;

    return {
      runtime,
      marketRole: marketRole.roleId,
      runner: {
        runnerKind: "openai",
        modelProvider: "openai",
        model: config.model,
        skillName,
        promptVersion
      },
      generator: createOpenAiMemoryLessonCandidatesGenerator(config, { marketRole })
    };
  }

  const promptVersion = marketRole.promptVersionSuffix
    ? `deterministic-memory-lessons-v1:${marketRole.promptVersionSuffix}`
    : "deterministic-memory-lessons-v1";

  return {
    runtime,
    marketRole: marketRole.roleId,
    runner: {
      runnerKind: "deterministic",
      modelProvider: null,
      model: null,
      skillName,
      promptVersion
    },
    generator: ({ review, pipeline }) =>
      generateDeterministicMemoryLessonCandidates(review, pipeline)
  };
}
