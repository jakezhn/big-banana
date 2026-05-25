import type {
  PostPlanReviewRepository,
  ReceivedPostPlanReview,
  StoredPostPlanReview
} from "@big-banana/domain";
import { type Sql } from "postgres";
import { getSharedSqlClientFromEnv } from "../sql/shared-sql-client";

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

export class PostgresPostPlanReviewRepository
  implements PostPlanReviewRepository
{
  constructor(private readonly sql: Sql) {}

  async getPostPlanReviewById(
    reviewId: string
  ): Promise<StoredPostPlanReview | null> {
    const [row] = await this.sql<PostPlanReviewRow[]>`
      select *
      from post_plan_reviews
      where id = ${reviewId}
      limit 1
    `;

    return row ? mapPostPlanReviewRow(row) : null;
  }

  async recordPostPlanReview(
    review: ReceivedPostPlanReview
  ): Promise<StoredPostPlanReview> {
    const [row] = await this.sql<PostPlanReviewRow[]>`
      insert into post_plan_reviews (
        plan_id,
        trade_plan_version_id,
        market_key,
        source_event_key,
        outcome_summary,
        what_worked_json,
        what_failed_json,
        missed_context_json,
        early_warning_signals_json,
        lesson_candidates_json,
        should_update_strategy_memory,
        agent_run_id,
        created_at
      ) values (
        ${review.planId},
        ${review.tradePlanVersionId},
        ${review.marketKey},
        ${review.sourceEventKey},
        ${review.outcomeSummary},
        ${this.sql.json(review.whatWorked)},
        ${this.sql.json(review.whatFailed)},
        ${this.sql.json(review.missedContext)},
        ${this.sql.json(review.earlyWarningSignals)},
        ${this.sql.json(review.lessonCandidates)},
        ${review.shouldUpdateStrategyMemory},
        ${review.agentRunId},
        ${review.createdAt}
      )
      returning *
    `;

    if (!row) {
      throw new Error("Failed to persist post-plan review");
    }

    return mapPostPlanReviewRow(row);
  }

  async getLatestPostPlanReviewByPlanId(
    planId: string
  ): Promise<StoredPostPlanReview | null> {
    const [row] = await this.sql<PostPlanReviewRow[]>`
      select *
      from post_plan_reviews
      where plan_id = ${planId}
      order by created_at desc
      limit 1
    `;

    return row ? mapPostPlanReviewRow(row) : null;
  }

  async listPostPlanReviewsByPlanId(
    planId: string,
    limit = 20
  ): Promise<StoredPostPlanReview[]> {
    const rows = await this.sql<PostPlanReviewRow[]>`
      select *
      from post_plan_reviews
      where plan_id = ${planId}
      order by created_at desc
      limit ${Math.max(1, limit)}
    `;

    return rows.map(mapPostPlanReviewRow);
  }
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

export function createPostPlanReviewRepositoryFromEnv(): PostgresPostPlanReviewRepository {
  return new PostgresPostPlanReviewRepository(getSharedSqlClientFromEnv());
}
