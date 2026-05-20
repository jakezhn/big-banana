import {
  validateExecutionIntent,
  type ExecutionIntent
} from "@big-banana/contracts";
import type { StoredOrder } from "../orders/order-repository";
import type { StoredTradePlanVersion } from "../plans/trade-plan-version-repository";
import type {
  ExecutionIntentRepository,
  StoredExecutionIntent
} from "./execution-intent-repository";
import type { StoredRiskVerdict } from "../risk/risk-verdict-repository";

export type OperatorExecutionIntentAction = "close";

export class InvalidOperatorExecutionIntentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOperatorExecutionIntentError";
  }
}

export function buildOperatorExecutionIntent(
  action: OperatorExecutionIntentAction,
  tradePlanVersion: StoredTradePlanVersion,
  riskVerdict: StoredRiskVerdict,
  latestOrder: StoredOrder
): ExecutionIntent {
  if (action !== "close") {
    throw new InvalidOperatorExecutionIntentError(
      `Unsupported operator action: ${action}`
    );
  }

  const qty = latestOrder.filledQty > 0 ? latestOrder.filledQty : latestOrder.requestedQty;

  if (qty <= 0) {
    throw new InvalidOperatorExecutionIntentError(
      "Close interventions require a positive quantity"
    );
  }

  const payload: ExecutionIntent = {
    action: "close",
    plan_version_id: tradePlanVersion.id,
    trading_account_id: riskVerdict.tradingAccountId,
    symbol: latestOrder.symbol,
    side: latestOrder.side === "buy" ? "sell" : "buy",
    order_type: "market",
    time_in_force: "IOC",
    qty,
    price: null,
    stop_price: null,
    reduce_only: true,
    client_order_id: buildClientOrderId(latestOrder.symbol, tradePlanVersion.version),
    idempotency_key: `${latestOrder.id}:operator:${action}`
  };

  if (!validateExecutionIntent(payload)) {
    throw new InvalidOperatorExecutionIntentError(
      "Built operator execution intent does not satisfy the frozen schema"
    );
  }

  return payload;
}

export async function buildAndRecordOperatorExecutionIntent(
  action: OperatorExecutionIntentAction,
  tradePlanVersion: StoredTradePlanVersion,
  riskVerdict: StoredRiskVerdict,
  latestOrder: StoredOrder,
  repository: ExecutionIntentRepository,
  createdAt = new Date().toISOString()
): Promise<StoredExecutionIntent> {
  const payload = buildOperatorExecutionIntent(
    action,
    tradePlanVersion,
    riskVerdict,
    latestOrder
  );

  return repository.recordExecutionIntent({
    tradePlanVersionId: tradePlanVersion.id,
    riskVerdictId: riskVerdict.id,
    tradingAccountId: riskVerdict.tradingAccountId,
    payload,
    createdAt
  });
}

function buildClientOrderId(symbol: string, version: number): string {
  return `${symbol}-flat-v${version}`.slice(0, 36);
}
