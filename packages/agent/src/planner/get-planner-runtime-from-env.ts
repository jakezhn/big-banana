export const plannerRuntimes = ["deterministic", "openai"] as const;

export type PlannerRuntime = (typeof plannerRuntimes)[number];

const DEFAULT_PLANNER_RUNTIME: PlannerRuntime = "deterministic";

export function getPlannerRuntimeFromEnv(
  env: NodeJS.ProcessEnv = process.env
): PlannerRuntime {
  const value = env.PLANNER_RUNTIME;

  if (value === "openai" || value === "deterministic") {
    return value;
  }

  return DEFAULT_PLANNER_RUNTIME;
}
