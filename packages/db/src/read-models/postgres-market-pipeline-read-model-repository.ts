import type {
  MarketPipelineReadModel,
  MarketPipelineReadModelRepository,
  StoredExecutionIntent,
  StoredMarketState,
  StoredOrder,
  StoredRiskVerdict,
  StoredTradePlanVersion
} from "@big-banana/domain";
import { type Sql } from "postgres";
import { getSharedSqlClientFromEnv } from "../sql/shared-sql-client";

type MarketStateRow = {
  market_key: string;
  webhook_event_id: string;
  tickerid: string;
  timeframe: string;
  bar_time_ms: string | number;
  context_json: StoredMarketState["context"];
  updated_at: string;
};

type TradePlanVersionRow = {
  id: string;
  plan_id: string;
  version: number;
  market_key: string;
  source_event_key: string;
  action: StoredTradePlanVersion["action"];
  market_thesis_json: StoredTradePlanVersion["marketThesis"];
  execution_playbook_json: StoredTradePlanVersion["executionPlaybook"];
  risk_intent_json: StoredTradePlanVersion["riskIntent"];
  reasoning_summary: string;
  evidence_json: StoredTradePlanVersion["evidence"];
  created_at: string;
};

type RiskVerdictRow = {
  id: string;
  trade_plan_version_id: string;
  trading_account_id: string;
  verdict: StoredRiskVerdict["verdict"];
  approved_risk_pct: StoredRiskVerdict["approvedRiskPct"];
  approved_qty: StoredRiskVerdict["approvedQty"];
  approved_notional: StoredRiskVerdict["approvedNotional"];
  approved_stop_price: StoredRiskVerdict["approvedStopPrice"];
  require_human_approval: boolean;
  checks_json: StoredRiskVerdict["checks"];
  rejection_codes_json: StoredRiskVerdict["rejectionCodes"];
  created_at: string;
};

type ExecutionIntentRow = {
  id: string;
  trade_plan_version_id: string;
  risk_verdict_id: string;
  trading_account_id: string;
  payload_json: StoredExecutionIntent["payload"];
  created_at: string;
};

type OrderRow = {
  id: string;
  execution_intent_id: string;
  trading_account_id: string;
  venue: string;
  symbol: string;
  side: StoredOrder["side"];
  order_type: StoredOrder["orderType"];
  time_in_force: StoredOrder["timeInForce"];
  reduce_only: boolean;
  client_order_id: string;
  exchange_order_id: string | null;
  status: StoredOrder["status"];
  requested_qty: StoredOrder["requestedQty"];
  requested_price: StoredOrder["requestedPrice"];
  stop_price: StoredOrder["stopPrice"];
  avg_fill_price: StoredOrder["avgFillPrice"];
  filled_qty: StoredOrder["filledQty"];
  submitted_at: string;
  last_exchange_update_at: string;
  terminal_at: string | null;
  raw_exchange_json: StoredOrder["rawExchangeJson"];
};

export class PostgresMarketPipelineReadModelRepository
  implements MarketPipelineReadModelRepository
{
  constructor(private readonly sql: Sql) {}

  async getLatestMarketPipeline(
    marketKey: string
  ): Promise<MarketPipelineReadModel | null> {
    const [marketStateRow] = await this.sql<MarketStateRow[]>`
      select *
      from market_states_current
      where market_key = ${marketKey}
      limit 1
    `;

    if (!marketStateRow) {
      return null;
    }

    const [tradePlanVersionRow] = await this.sql<TradePlanVersionRow[]>`
      select *
      from trade_plan_versions
      where market_key = ${marketKey}
      order by created_at desc, version desc
      limit 1
    `;

    const tradePlanVersion = tradePlanVersionRow
      ? mapTradePlanVersionRow(tradePlanVersionRow)
      : null;

    const [riskVerdictRow] = tradePlanVersion
      ? await this.sql<RiskVerdictRow[]>`
          select *
          from risk_verdicts
          where trade_plan_version_id = ${tradePlanVersion.id}
          order by created_at desc
          limit 1
        `
      : [];

    const riskVerdict = riskVerdictRow ? mapRiskVerdictRow(riskVerdictRow) : null;

    const [executionIntentRow] = riskVerdict
      ? await this.sql<ExecutionIntentRow[]>`
          select *
          from execution_intents
          where risk_verdict_id = ${riskVerdict.id}
          order by created_at desc
          limit 1
        `
      : [];

    const executionIntent = executionIntentRow
      ? mapExecutionIntentRow(executionIntentRow)
      : null;

    const [orderRow] = executionIntent
      ? await this.sql<OrderRow[]>`
          select *
          from orders
          where execution_intent_id = ${executionIntent.id}
          order by submitted_at desc
          limit 1
        `
      : [];

    return {
      marketKey,
      marketState: mapMarketStateRow(marketStateRow),
      tradePlanVersion,
      riskVerdict,
      executionIntent,
      latestOrder: orderRow ? mapOrderRow(orderRow) : null
    };
  }
}

function mapMarketStateRow(row: MarketStateRow): StoredMarketState {
  return {
    id: row.market_key,
    marketKey: row.market_key,
    webhookEventId: row.webhook_event_id,
    tickerid: row.tickerid,
    timeframe: row.timeframe,
    barTimeMs: Number(row.bar_time_ms),
    context: row.context_json,
    createdAt: row.updated_at
  };
}

function mapTradePlanVersionRow(
  row: TradePlanVersionRow
): StoredTradePlanVersion {
  return {
    id: row.id,
    planId: row.plan_id,
    version: row.version,
    marketKey: row.market_key,
    sourceEventKey: row.source_event_key,
    action: row.action,
    marketThesis: row.market_thesis_json,
    executionPlaybook: row.execution_playbook_json,
    riskIntent: row.risk_intent_json,
    reasoningSummary: row.reasoning_summary,
    evidence: row.evidence_json,
    createdAt: row.created_at
  };
}

function mapRiskVerdictRow(row: RiskVerdictRow): StoredRiskVerdict {
  return {
    id: row.id,
    tradePlanVersionId: row.trade_plan_version_id,
    tradingAccountId: row.trading_account_id,
    verdict: row.verdict,
    approvedRiskPct: toNumber(row.approved_risk_pct),
    approvedQty: toNumberOrNull(row.approved_qty),
    approvedNotional: toNumberOrNull(row.approved_notional),
    approvedStopPrice: toNumberOrNull(row.approved_stop_price),
    requireHumanApproval: row.require_human_approval,
    checks: row.checks_json,
    rejectionCodes: row.rejection_codes_json,
    createdAt: row.created_at
  };
}

function mapExecutionIntentRow(row: ExecutionIntentRow): StoredExecutionIntent {
  return {
    id: row.id,
    tradePlanVersionId: row.trade_plan_version_id,
    riskVerdictId: row.risk_verdict_id,
    tradingAccountId: row.trading_account_id,
    payload: row.payload_json,
    createdAt: row.created_at
  };
}

function mapOrderRow(row: OrderRow): StoredOrder {
  return {
    id: row.id,
    executionIntentId: row.execution_intent_id,
    tradingAccountId: row.trading_account_id,
    venue: row.venue,
    symbol: row.symbol,
    side: row.side,
    orderType: row.order_type,
    timeInForce: row.time_in_force,
    reduceOnly: row.reduce_only,
    clientOrderId: row.client_order_id,
    exchangeOrderId: row.exchange_order_id,
    status: row.status,
    requestedQty: toNumber(row.requested_qty),
    requestedPrice: toNumberOrNull(row.requested_price),
    stopPrice: toNumberOrNull(row.stop_price),
    avgFillPrice: toNumberOrNull(row.avg_fill_price),
    filledQty: toNumber(row.filled_qty),
    submittedAt: row.submitted_at,
    lastExchangeUpdateAt: row.last_exchange_update_at,
    terminalAt: row.terminal_at,
    rawExchangeJson: row.raw_exchange_json
  };
}

export function createMarketPipelineReadModelRepositoryFromEnv(): PostgresMarketPipelineReadModelRepository {
  return new PostgresMarketPipelineReadModelRepository(
    getSharedSqlClientFromEnv()
  );
}

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function toNumberOrNull(value: number | string | null): number | null {
  if (value === null) {
    return null;
  }

  return toNumber(value);
}
