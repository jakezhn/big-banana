import type {
  MemoryLessonCandidateRepository,
  ReceivedMemoryLessonCandidate,
  StoredMemoryLessonCandidate
} from "@big-banana/domain";
import { type Sql } from "postgres";
import { getSharedSqlClientFromEnv } from "../sql/shared-sql-client";

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

export class PostgresMemoryLessonCandidateRepository
  implements MemoryLessonCandidateRepository
{
  constructor(private readonly sql: Sql) {}

  async recordMemoryLessonCandidate(
    candidate: ReceivedMemoryLessonCandidate
  ): Promise<StoredMemoryLessonCandidate> {
    const [row] = await this.sql<MemoryLessonCandidateRow[]>`
      insert into memory_lesson_candidates (
        post_plan_review_id,
        plan_id,
        trade_plan_version_id,
        market_key,
        source_event_key,
        lesson,
        scope_market,
        scope_asset_class,
        scope_symbol,
        scope_timeframe,
        scope_regime,
        scope_signal_type,
        confidence,
        sample_size,
        decay_days,
        retrieval_hint,
        status,
        agent_run_id,
        created_at
      ) values (
        ${candidate.postPlanReviewId},
        ${candidate.planId},
        ${candidate.tradePlanVersionId},
        ${candidate.marketKey},
        ${candidate.sourceEventKey},
        ${candidate.lesson},
        ${candidate.scopeMarket},
        ${candidate.scopeAssetClass},
        ${candidate.scopeSymbol},
        ${candidate.scopeTimeframe},
        ${candidate.scopeRegime},
        ${candidate.scopeSignalType},
        ${candidate.confidence},
        ${candidate.sampleSize},
        ${candidate.decayDays},
        ${candidate.retrievalHint},
        ${candidate.status},
        ${candidate.agentRunId},
        ${candidate.createdAt}
      )
      returning *
    `;

    if (!row) {
      throw new Error("Failed to persist memory lesson candidate");
    }

    return mapMemoryLessonCandidateRow(row);
  }

  async listMemoryLessonCandidatesByPostPlanReviewId(
    postPlanReviewId: string
  ): Promise<StoredMemoryLessonCandidate[]> {
    const rows = await this.sql<MemoryLessonCandidateRow[]>`
      select *
      from memory_lesson_candidates
      where post_plan_review_id = ${postPlanReviewId}
      order by created_at desc
    `;

    return rows.map(mapMemoryLessonCandidateRow);
  }
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
    confidence:
      typeof row.confidence === "number"
        ? row.confidence
        : Number.parseFloat(row.confidence),
    sampleSize: row.sample_size,
    decayDays: row.decay_days,
    retrievalHint: row.retrieval_hint,
    status: row.status,
    agentRunId: row.agent_run_id,
    createdAt: row.created_at
  };
}

export function createMemoryLessonCandidateRepositoryFromEnv(): PostgresMemoryLessonCandidateRepository {
  return new PostgresMemoryLessonCandidateRepository(getSharedSqlClientFromEnv());
}
