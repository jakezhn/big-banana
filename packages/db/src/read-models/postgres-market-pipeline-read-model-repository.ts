import type {
  MarketPipelineReadModel,
  MarketPipelineReadModelRepository,
  StoredFill,
  StoredExecutionIntent,
  StoredMarketState,
  StoredMemoryLessonCandidate,
  StoredOrder,
  StoredPlanRevisionSuggestion,
  StoredPositionSnapshot,
  StoredPostPlanReview,
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

type FillRow = {
  id: string;
  order_id: string;
  execution_intent_id: string;
  trading_account_id: string;
  venue: string;
  symbol: string;
  side: StoredFill["side"];
  qty: string | number;
  price: string | number;
  filled_at: string;
  exchange_fill_id: string;
  raw_exchange_json: StoredFill["rawExchangeJson"];
};

type PositionCurrentRow = {
  id: string;
  trading_account_id: string;
  symbol: string;
  market_key: string;
  position_side: StoredPositionSnapshot["positionSide"];
  signed_qty: string | number;
  avg_entry_price: string | number | null;
  opened_at: string | null;
  closed_at: string | null;
  updated_at: string;
  last_fill_id: string;
};

type PlanRevisionSuggestionRow = {
  id: string;
  plan_id: string;
  trade_plan_version_id: string;
  market_key: string;
  source_event_key: string;
  revision_action: StoredPlanRevisionSuggestion["revisionAction"];
  reason: string;
  changed_fields_json: StoredPlanRevisionSuggestion["changedFields"];
  new_invalidation_json: StoredPlanRevisionSuggestion["newInvalidation"];
  new_management_rules_json: StoredPlanRevisionSuggestion["newManagementRules"];
  requires_user_review: boolean;
  agent_run_id: string | null;
  created_at: string;
};

type PostPlanReviewRow = {
  id: string;
  plan_id: string;
  trade_plan_version_id: string;
  market_key: string;
  source_event_key: string;
  outcome_summary: string;
  what_worked_json: string[];
  what_failed_json: string[];
  missed_context_json: string[];
  early_warning_signals_json: string[];
  lesson_candidates_json: string[];
  should_update_strategy_memory: boolean;
  agent_run_id: string | null;
  created_at: string;
};

type MemoryLessonCandidateRow = {
  id: string;
  post_plan_review_id: string;
  plan_id: string;
  trade_plan_version_id: string;
  market_key: string;
  source_event_key: string;
  lesson: string;
  scope_market: string;
  scope_asset_class: string | null;
  scope_symbol: string | null;
  scope_timeframe: string | null;
  scope_regime: string | null;
  scope_signal_type: string | null;
  confidence: string | number;
  sample_size: number;
  decay_days: number;
  retrieval_hint: string;
  status: StoredMemoryLessonCandidate["status"];
  agent_run_id: string | null;
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

    const [planRevisionSuggestionRow] = tradePlanVersion
      ? await this.sql<PlanRevisionSuggestionRow[]>`
          select *
          from plan_revision_suggestions
          where plan_id = ${tradePlanVersion.planId}
          order by created_at desc
          limit 1
        `
      : [];

    const [postPlanReviewRow] = tradePlanVersion
      ? await this.sql<PostPlanReviewRow[]>`
          select *
          from post_plan_reviews
          where plan_id = ${tradePlanVersion.planId}
          order by created_at desc
          limit 1
        `
      : [];

    const memoryLessonCandidateRows = postPlanReviewRow
      ? await this.sql<MemoryLessonCandidateRow[]>`
          select *
          from memory_lesson_candidates
          where post_plan_review_id = ${postPlanReviewRow.id}
          order by created_at desc
        `
      : [];

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

    const [fillRow] = orderRow
      ? await this.sql<FillRow[]>`
          select *
          from fills
          where order_id = ${orderRow.id}
          order by filled_at desc
          limit 1
        `
      : [];

    const [positionRow] = orderRow
      ? await this.sql<PositionCurrentRow[]>`
          select *
          from positions_current
          where trading_account_id = ${orderRow.trading_account_id}
            and symbol = ${orderRow.symbol}
          limit 1
        `
      : [];

    return {
      marketKey,
      marketState: mapMarketStateRow(marketStateRow),
      tradePlanVersion,
      latestPlanRevisionSuggestion: planRevisionSuggestionRow
        ? mapPlanRevisionSuggestionRow(planRevisionSuggestionRow)
        : null,
      latestPostPlanReview: postPlanReviewRow
        ? mapPostPlanReviewRow(postPlanReviewRow)
        : null,
      memoryLessonCandidates: memoryLessonCandidateRows.map(
        mapMemoryLessonCandidateRow
      ),
      riskVerdict,
      executionIntent,
      latestOrder: orderRow ? mapOrderRow(orderRow) : null,
      latestFill: fillRow ? mapFillRow(fillRow) : null,
      currentPosition: positionRow ? mapPositionCurrentRow(positionRow) : null
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

function mapFillRow(row: FillRow): StoredFill {
  return {
    id: row.id,
    orderId: row.order_id,
    executionIntentId: row.execution_intent_id,
    tradingAccountId: row.trading_account_id,
    venue: row.venue,
    symbol: row.symbol,
    side: row.side,
    qty: toNumber(row.qty),
    price: toNumber(row.price),
    filledAt: row.filled_at,
    exchangeFillId: row.exchange_fill_id,
    rawExchangeJson: row.raw_exchange_json
  };
}

function mapPositionCurrentRow(
  row: PositionCurrentRow
): StoredPositionSnapshot {
  return {
    id: row.id,
    tradingAccountId: row.trading_account_id,
    symbol: row.symbol,
    marketKey: row.market_key,
    positionSide: row.position_side,
    signedQty: toNumber(row.signed_qty),
    avgEntryPrice: toNumberOrNull(row.avg_entry_price),
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    updatedAt: row.updated_at,
    lastFillId: row.last_fill_id
  };
}

function mapPlanRevisionSuggestionRow(
  row: PlanRevisionSuggestionRow
): StoredPlanRevisionSuggestion {
  return {
    id: row.id,
    planId: row.plan_id,
    tradePlanVersionId: row.trade_plan_version_id,
    marketKey: row.market_key,
    sourceEventKey: row.source_event_key,
    revisionAction: row.revision_action,
    reason: row.reason,
    changedFields: row.changed_fields_json,
    newInvalidation: row.new_invalidation_json,
    newManagementRules: row.new_management_rules_json,
    requiresUserReview: row.requires_user_review,
    agentRunId: row.agent_run_id,
    createdAt: row.created_at
  };
}

function mapPostPlanReviewRow(row: PostPlanReviewRow): StoredPostPlanReview {
  return {
    id: row.id,
    planId: row.plan_id,
    tradePlanVersionId: row.trade_plan_version_id,
    marketKey: row.market_key,
    sourceEventKey: row.source_event_key,
    outcomeSummary: row.outcome_summary,
    whatWorked: row.what_worked_json,
    whatFailed: row.what_failed_json,
    missedContext: row.missed_context_json,
    earlyWarningSignals: row.early_warning_signals_json,
    lessonCandidates: row.lesson_candidates_json,
    shouldUpdateStrategyMemory: row.should_update_strategy_memory,
    agentRunId: row.agent_run_id,
    createdAt: row.created_at
  };
}

function mapMemoryLessonCandidateRow(
  row: MemoryLessonCandidateRow
): StoredMemoryLessonCandidate {
  return {
    id: row.id,
    postPlanReviewId: row.post_plan_review_id,
    planId: row.plan_id,
    tradePlanVersionId: row.trade_plan_version_id,
    marketKey: row.market_key,
    sourceEventKey: row.source_event_key,
    lesson: row.lesson,
    scopeMarket: row.scope_market,
    scopeAssetClass: row.scope_asset_class,
    scopeSymbol: row.scope_symbol,
    scopeTimeframe: row.scope_timeframe,
    scopeRegime: row.scope_regime,
    scopeSignalType: row.scope_signal_type,
    confidence: toNumber(row.confidence),
    sampleSize: row.sample_size,
    decayDays: row.decay_days,
    retrievalHint: row.retrieval_hint,
    status: row.status,
    agentRunId: row.agent_run_id,
    createdAt: row.created_at
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
