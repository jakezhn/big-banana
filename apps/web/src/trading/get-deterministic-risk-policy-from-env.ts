import type { RiskPolicySnapshot } from "@big-banana/domain";

const DEFAULT_RISK_POLICY: RiskPolicySnapshot = {
  tradingAccountId: "paper-tradingview",
  accountEquity: 20000,
  maxTradeRiskPct: 0.5,
  maxNotional: 100000,
  maxLeverage: 3,
  dailyLossLimitBreached: false,
  consecutiveLossLimitBreached: false,
  killSwitchEnabled: false,
  // Deprecated in runtime flow. The frozen contract still carries it.
  liveRequiresManualApproval: false
};

export function getDeterministicRiskPolicyFromEnv(
  env: NodeJS.ProcessEnv = process.env
): RiskPolicySnapshot {
  return {
    tradingAccountId:
      env.TRADING_ACCOUNT_ID ?? DEFAULT_RISK_POLICY.tradingAccountId,
    accountEquity: readNumber(
      env.PIPELINE_ACCOUNT_EQUITY,
      DEFAULT_RISK_POLICY.accountEquity
    ),
    maxTradeRiskPct: readNumber(
      env.PIPELINE_MAX_TRADE_RISK_PCT,
      DEFAULT_RISK_POLICY.maxTradeRiskPct
    ),
    maxNotional: readNumber(
      env.PIPELINE_MAX_NOTIONAL,
      DEFAULT_RISK_POLICY.maxNotional
    ),
    maxLeverage: readNumber(
      env.PIPELINE_MAX_LEVERAGE,
      DEFAULT_RISK_POLICY.maxLeverage
    ),
    requestedLeverage: readOptionalNumber(env.PIPELINE_REQUESTED_LEVERAGE),
    dailyLossLimitBreached: readBoolean(
      env.PIPELINE_DAILY_LOSS_LIMIT_BREACHED,
      DEFAULT_RISK_POLICY.dailyLossLimitBreached
    ),
    consecutiveLossLimitBreached: readBoolean(
      env.PIPELINE_CONSECUTIVE_LOSS_LIMIT_BREACHED,
      DEFAULT_RISK_POLICY.consecutiveLossLimitBreached
    ),
    killSwitchEnabled: readBoolean(
      env.PIPELINE_KILL_SWITCH_ENABLED,
      DEFAULT_RISK_POLICY.killSwitchEnabled
    ),
    liveRequiresManualApproval: DEFAULT_RISK_POLICY.liveRequiresManualApproval
  };
}

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readOptionalNumber(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return value === "true";
}
