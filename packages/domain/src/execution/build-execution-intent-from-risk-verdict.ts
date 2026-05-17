import {
  validateExecutionIntent,
  type ExecutionIntent,
  type RiskVerdict
} from "@big-banana/contracts";
import type { StoredTradePlanVersion } from "../plans/trade-plan-version-repository.js";
import type {
  ExecutionIntentRepository,
  StoredExecutionIntent
} from "./execution-intent-repository.js";
import type { StoredRiskVerdict } from "../risk/risk-verdict-repository.js";

export class UnsupportedExecutionIntentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedExecutionIntentError";
  }
}

export class InvalidBuiltExecutionIntentError extends Error {
  constructor() {
    super("Built execution intent does not satisfy the frozen schema");
    this.name = "InvalidBuiltExecutionIntentError";
  }
}

export function buildExecutionIntentFromApprovedRiskVerdict(
  tradePlanVersion: StoredTradePlanVersion,
  riskVerdict: Pick<
    StoredRiskVerdict,
    | "id"
    | "tradingAccountId"
    | "verdict"
    | "approvedQty"
    | "approvedStopPrice"
  >
): ExecutionIntent {
  if (
    riskVerdict.verdict !== "approve" &&
    riskVerdict.verdict !== "approve_with_reduction"
  ) {
    throw new UnsupportedExecutionIntentError(
      "Execution intents can only be built from approved risk verdicts"
    );
  }

  if (
    tradePlanVersion.executionPlaybook.state !== "armed" &&
    tradePlanVersion.executionPlaybook.state !== "pending_entry"
  ) {
    throw new UnsupportedExecutionIntentError(
      "Execution intents currently require an armed or pending-entry plan"
    );
  }

  if (tradePlanVersion.marketThesis.bias === "neutral") {
    throw new UnsupportedExecutionIntentError(
      "Neutral trade plans cannot become execution intents"
    );
  }

  if (riskVerdict.approvedQty === null || riskVerdict.approvedQty <= 0) {
    throw new UnsupportedExecutionIntentError(
      "Approved execution intents require a positive quantity"
    );
  }

  const symbol = extractSymbol(tradePlanVersion.marketKey);
  const price = getEntryPrice(tradePlanVersion);
  const payload: ExecutionIntent = {
    action: "open",
    plan_version_id: tradePlanVersion.id,
    trading_account_id: riskVerdict.tradingAccountId,
    symbol,
    side: tradePlanVersion.marketThesis.bias === "long" ? "buy" : "sell",
    order_type: "limit",
    time_in_force: "GTC",
    qty: riskVerdict.approvedQty,
    price,
    stop_price: riskVerdict.approvedStopPrice,
    reduce_only: false,
    client_order_id: buildClientOrderId(symbol, tradePlanVersion),
    idempotency_key: `${tradePlanVersion.id}:${riskVerdict.id}:open`
  };

  if (!validateExecutionIntent(payload)) {
    throw new InvalidBuiltExecutionIntentError();
  }

  return payload;
}

export async function buildAndRecordExecutionIntentFromRiskVerdict(
  tradePlanVersion: StoredTradePlanVersion,
  riskVerdict: StoredRiskVerdict,
  repository: ExecutionIntentRepository,
  createdAt = new Date().toISOString()
): Promise<StoredExecutionIntent> {
  const payload = buildExecutionIntentFromApprovedRiskVerdict(
    tradePlanVersion,
    riskVerdict
  );

  return repository.recordExecutionIntent({
    tradePlanVersionId: tradePlanVersion.id,
    riskVerdictId: riskVerdict.id,
    tradingAccountId: riskVerdict.tradingAccountId,
    payload,
    createdAt
  });
}

function extractSymbol(marketKey: string): string {
  const [tickerid] = marketKey.split(/:(?=[^:]+$)/);
  return tickerid.split(":").at(-1) ?? tickerid;
}

function getEntryPrice(tradePlanVersion: StoredTradePlanVersion): number | null {
  const { low, high } = tradePlanVersion.executionPlaybook.entry_zone;

  if (low === null || high === null) {
    return null;
  }

  return Number((((low + high) / 2)).toFixed(2));
}

function buildClientOrderId(
  symbol: string,
  tradePlanVersion: StoredTradePlanVersion
): string {
  const prefix = tradePlanVersion.marketThesis.bias === "long" ? "buy" : "sell";
  const raw = `${symbol}-${prefix}-v${tradePlanVersion.version}`;
  return raw.slice(0, 36);
}
