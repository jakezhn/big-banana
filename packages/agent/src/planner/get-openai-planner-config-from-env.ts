export type OpenAiPlannerConfig = {
  apiKey: string | null;
  baseUrl: string | null;
  model: string;
};

const DEFAULT_OPENAI_PLANNER_MODEL = "gpt-5.4-mini";

export function getOpenAiPlannerConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): OpenAiPlannerConfig {
  return {
    apiKey: env.OPENAI_API_KEY ?? null,
    baseUrl: env.OPENAI_BASE_URL ?? null,
    model: env.OPENAI_PLANNER_MODEL ?? DEFAULT_OPENAI_PLANNER_MODEL
  };
}
