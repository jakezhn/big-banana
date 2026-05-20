export const pipelineModes = ["full", "advisory"] as const;

export type PipelineMode = (typeof pipelineModes)[number];

const DEFAULT_PIPELINE_MODE: PipelineMode = "full";

export function getPipelineModeFromEnv(
  env: NodeJS.ProcessEnv = process.env
): PipelineMode {
  const value = env.PIPELINE_MODE;

  if (value === "advisory" || value === "full") {
    return value;
  }

  return DEFAULT_PIPELINE_MODE;
}
