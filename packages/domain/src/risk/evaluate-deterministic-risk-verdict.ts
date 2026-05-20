import { validateRiskVerdict, type RiskVerdict } from "@big-banana/contracts";
import type { StoredTradePlanVersion } from "../plans/trade-plan-version-repository";
import type {
  ReceivedRiskVerdict,
  RiskVerdictRepository,
  StoredRiskVerdict
} from "./risk-verdict-repository";

export type RiskPolicySnapshot = {
  tradingAccountId: string;
  accountEquity: number;
  maxTradeRiskPct: number;
  maxNotional: number;
  maxLeverage: number;
  requestedLeverage?: number;
  dailyLossLimitBreached: boolean;
  consecutiveLossLimitBreached: boolean;
  killSwitchEnabled: boolean;
  liveRequiresManualApproval: boolean;
};

export class InvalidEvaluatedRiskVerdictError extends Error {
  constructor() {
    super("Evaluated risk verdict does not satisfy the frozen schema");
    this.name = "InvalidEvaluatedRiskVerdictError";
  }
}

export function evaluateDeterministicRiskVerdict(
  tradePlanVersion: StoredTradePlanVersion,
  policy: RiskPolicySnapshot
): RiskVerdict {
  const openCandidate = isOpenCandidate(tradePlanVersion);
  const entryPrice = getEntryPrice(tradePlanVersion);
  const stopPrice = getStopPrice(tradePlanVersion);
  const hasStop = stopPrice !== null && entryPrice !== null && stopPrice !== entryPrice;
  const entryZoneReady = hasEntryZone(tradePlanVersion);
  const requestedRiskPct =
    tradePlanVersion.riskIntent.suggested_max_account_risk_pct;
  const approvedRiskPct = openCandidate
    ? Math.min(requestedRiskPct, policy.maxTradeRiskPct)
    : 0;
  const approvedQty =
    openCandidate && entryPrice !== null && stopPrice !== null
      ? calculateQty(policy.accountEquity, approvedRiskPct, entryPrice, stopPrice)
      : null;
  const approvedNotional =
    approvedQty !== null && entryPrice !== null
      ? round(approvedQty * entryPrice)
      : null;
  const checks: RiskVerdict["checks"] = [
    buildCheck(
      "REQUIRE_STOP",
      !openCandidate || hasStop,
      !openCandidate
        ? "No opening action requires stop validation."
        : hasStop
          ? "A stop anchor can be mapped to a concrete stop price."
          : "Opening actions require a non-zero stop distance."
    ),
    buildCheck(
      "ENTRY_ZONE_READY",
      !openCandidate || entryZoneReady,
      !openCandidate
        ? "No opening action requires entry zone validation."
        : entryZoneReady
          ? "Entry zone is defined and executable."
          : "Opening actions require a concrete entry zone."
    ),
    buildCheck(
      "MAX_TRADE_RISK",
      !openCandidate || requestedRiskPct <= policy.maxTradeRiskPct,
      !openCandidate
        ? "No opening action consumes account risk."
        : requestedRiskPct <= policy.maxTradeRiskPct
          ? "Requested trade risk is within policy."
          : `Requested risk ${requestedRiskPct}% exceeds max ${policy.maxTradeRiskPct}%.`,
      requestedRiskPct > policy.maxTradeRiskPct
    ),
    buildCheck(
      "MAX_DAILY_LOSS",
      !openCandidate || !policy.dailyLossLimitBreached,
      !openCandidate
        ? "No opening action is blocked by daily loss rules."
        : policy.dailyLossLimitBreached
          ? "Daily loss limit has been breached."
          : "Daily loss is within the allowed threshold."
    ),
    buildCheck(
      "MAX_CONSECUTIVE_LOSSES",
      !openCandidate || !policy.consecutiveLossLimitBreached,
      !openCandidate
        ? "No opening action is blocked by loss streak rules."
        : policy.consecutiveLossLimitBreached
          ? "Maximum consecutive losses threshold has been reached."
          : "Consecutive losses are within the allowed threshold."
    ),
    buildCheck(
      "MAX_LEVERAGE",
      !openCandidate || (policy.requestedLeverage ?? 1) <= policy.maxLeverage,
      !openCandidate
        ? "No opening action requires leverage validation."
        : (policy.requestedLeverage ?? 1) <= policy.maxLeverage
          ? "Requested leverage is within policy."
          : `Requested leverage ${policy.requestedLeverage ?? 1} exceeds max ${policy.maxLeverage}.`
    ),
    buildCheck(
      "MAX_NOTIONAL",
      !openCandidate || approvedNotional === null || approvedNotional <= policy.maxNotional,
      !openCandidate
        ? "No opening action requires notional validation."
        : approvedNotional === null
          ? "Notional cannot be derived until entry and stop prices are available."
          : approvedNotional <= policy.maxNotional
            ? "Approved notional is within policy."
            : `Approved notional ${approvedNotional} exceeds max ${policy.maxNotional}.`,
      approvedNotional !== null && approvedNotional > policy.maxNotional
    ),
    buildCheck(
      "KILL_SWITCH",
      !openCandidate || !policy.killSwitchEnabled,
      !openCandidate
        ? "No opening action is blocked by the kill switch."
        : policy.killSwitchEnabled
          ? "Kill switch is enabled; only reduction and close actions are allowed."
          : "Kill switch is not enabled."
    ),
    buildCheck(
      "REDUCE_ONLY_EXIT",
      true,
      "Exit-side reduce-only enforcement is deferred until execution intent generation."
    )
  ];

  const failCodes = checks
    .filter((check) => check.status === "fail")
    .map((check) => check.code);
  const warnOnly =
    failCodes.length === 0 && checks.some((check) => check.status === "warn");

  return {
    verdict:
      failCodes.length > 0
        ? "reject"
        : warnOnly
          ? "approve_with_reduction"
          : "approve",
    approved_risk_pct: failCodes.length > 0 ? 0 : approvedRiskPct,
    approved_qty: failCodes.length > 0 ? null : approvedQty,
    approved_notional: failCodes.length > 0 ? null : approvedNotional,
    approved_stop_price: failCodes.length > 0 ? null : stopPrice,
    // Human approval is retired from the runtime path; keep the field frozen
    // in the contract but always emit false.
    require_human_approval: false,
    checks,
    rejection_codes: failCodes
  };
}

export async function evaluateAndRecordDeterministicRiskVerdict(
  tradePlanVersion: StoredTradePlanVersion,
  policy: RiskPolicySnapshot,
  repository: RiskVerdictRepository,
  createdAt = new Date().toISOString()
): Promise<StoredRiskVerdict> {
  const verdict = evaluateDeterministicRiskVerdict(tradePlanVersion, policy);

  if (!validateRiskVerdict(verdict)) {
    throw new InvalidEvaluatedRiskVerdictError();
  }

  return repository.recordRiskVerdict({
    tradePlanVersionId: tradePlanVersion.id,
    tradingAccountId: policy.tradingAccountId,
    verdict: verdict.verdict,
    approvedRiskPct: verdict.approved_risk_pct,
    approvedQty: verdict.approved_qty,
    approvedNotional: verdict.approved_notional,
    approvedStopPrice: verdict.approved_stop_price,
    requireHumanApproval: verdict.require_human_approval,
    checks: verdict.checks,
    rejectionCodes: verdict.rejection_codes,
    createdAt
  });
}

function isOpenCandidate(tradePlanVersion: StoredTradePlanVersion): boolean {
  return (
    (tradePlanVersion.action === "create" || tradePlanVersion.action === "patch") &&
    (tradePlanVersion.executionPlaybook.state === "armed" ||
      tradePlanVersion.executionPlaybook.state === "pending_entry")
  );
}

function hasEntryZone(tradePlanVersion: StoredTradePlanVersion): boolean {
  const { low, high } = tradePlanVersion.executionPlaybook.entry_zone;
  return low !== null && high !== null && low <= high;
}

function getEntryPrice(
  tradePlanVersion: StoredTradePlanVersion
): number | null {
  const { low, high } = tradePlanVersion.executionPlaybook.entry_zone;

  if (low === null || high === null) {
    return null;
  }

  return round((low + high) / 2);
}

function getStopPrice(
  tradePlanVersion: StoredTradePlanVersion
): number | null {
  const entryPrice = getEntryPrice(tradePlanVersion);
  const { low, high } = tradePlanVersion.executionPlaybook.entry_zone;

  if (entryPrice === null || low === null || high === null) {
    return null;
  }

  if (tradePlanVersion.marketThesis.bias === "long") {
    return low;
  }

  if (tradePlanVersion.marketThesis.bias === "short") {
    return high;
  }

  return null;
}

function calculateQty(
  accountEquity: number,
  approvedRiskPct: number,
  entryPrice: number,
  stopPrice: number
): number | null {
  const distance = Math.abs(entryPrice - stopPrice);

  if (distance <= 0) {
    return null;
  }

  return round((accountEquity * (approvedRiskPct / 100)) / distance);
}

function buildCheck(
  code: string,
  passed: boolean,
  detail: string,
  warn = false
): RiskVerdict["checks"][number] {
  return {
    code,
    status: passed ? "pass" : warn ? "warn" : "fail",
    detail
  };
}

function round(value: number): number {
  return Number(value.toFixed(6));
}
