import type {
  MarketPipelineReadModel,
  MarketPipelineReadModelRepository,
  StoredExecutionIntent,
  StoredMarketState,
  StoredRiskVerdict,
  StoredTradePlanVersion
} from "@big-banana/domain";
import postgres, { type Sql } from "postgres";

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

    return {
      marketKey,
      marketState: mapMarketStateRow(marketStateRow),
      tradePlanVersion,
      riskVerdict,
      executionIntent: executionIntentRow
        ? mapExecutionIntentRow(executionIntentRow)
        : null
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
    approvedRiskPct: row.approved_risk_pct,
    approvedQty: row.approved_qty,
    approvedNotional: row.approved_notional,
    approvedStopPrice: row.approved_stop_price,
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

export function createMarketPipelineReadModelRepositoryFromEnv(): PostgresMarketPipelineReadModelRepository {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return new PostgresMarketPipelineReadModelRepository(postgres(databaseUrl));
}
