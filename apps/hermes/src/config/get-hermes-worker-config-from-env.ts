import type { AgentJobMarket, AgentJobType } from "@big-banana/domain";

export type HermesWorkerConfig = {
  workerId: string;
  pollIntervalMs: number;
  lockTtlSeconds: number;
  jobTypes: AgentJobType[];
  markets: AgentJobMarket[] | undefined;
  tradingAccountId: string;
};

const supportedJobTypes: AgentJobType[] = [
  "analyze_market_context",
  "analyze_signal_context",
  "generate_plan",
  "revise_plan",
  "risk_review",
  "execution_review",
  "post_plan_review",
  "memory_curate",
  "replay_planner"
];

const supportedMarkets: AgentJobMarket[] = [
  "global",
  "crypto",
  "us_equity",
  "cn_equity",
  "commodity",
  "unknown"
];

export function getHermesWorkerConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): HermesWorkerConfig {
  return {
    workerId: env.HERMES_WORKER_ID?.trim() || `hermes-${process.pid}`,
    pollIntervalMs: parsePositiveInt(env.HERMES_POLL_INTERVAL_MS, 1_000),
    lockTtlSeconds: parsePositiveInt(env.HERMES_LOCK_TTL_SECONDS, 60),
    jobTypes: parseEnumList(
      env.HERMES_JOB_TYPES,
      supportedJobTypes,
      ["generate_plan", "replay_planner"]
    ),
    markets: parseOptionalEnumList(env.HERMES_JOB_MARKETS, supportedMarkets),
    tradingAccountId: requireNonEmptyString(
      env.TRADING_ACCOUNT_ID,
      "TRADING_ACCOUNT_ID"
    )
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid positive integer: ${value}`);
  }

  return parsed;
}

function parseEnumList<T extends string>(
  value: string | undefined,
  supported: readonly T[],
  fallback: T[]
): T[] {
  const parsed = parseOptionalEnumList(value, supported);
  return parsed && parsed.length > 0 ? parsed : fallback;
}

function parseOptionalEnumList<T extends string>(
  value: string | undefined,
  supported: readonly T[]
): T[] | undefined {
  if (!value || value.trim() === "") {
    return undefined;
  }

  const tokens = value
    .split(",")
    .map((token) => token.trim())
    .filter((token): token is T => token.length > 0);

  for (const token of tokens) {
    if (!supported.includes(token)) {
      throw new Error(`Unsupported value: ${token}`);
    }
  }

  return tokens;
}

function requireNonEmptyString(
  value: string | undefined,
  name: string
): string {
  if (!value || value.trim() === "") {
    throw new Error(`${name} is required`);
  }

  return value.trim();
}
