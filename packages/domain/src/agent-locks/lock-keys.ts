export function buildSymbolLockKey(
  market: string,
  symbol: string
): string {
  return `symbol:${market}:${symbol}`;
}

export function buildPlanLockKey(planId: string): string {
  return `plan:${planId}`;
}

export function buildRiskLockKey(accountId: string): string {
  return `risk:${accountId}`;
}

export function buildExecutionLockKey(accountId: string): string {
  return `execution:${accountId}`;
}
