import type {
  PlanRevisionSuggestionRepository,
  ReceivedPlanRevisionSuggestion,
  StoredPlanRevisionSuggestion
} from "@big-banana/domain";
import { type Sql } from "postgres";
import { getSharedSqlClientFromEnv } from "../sql/shared-sql-client";

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

export class PostgresPlanRevisionSuggestionRepository
  implements PlanRevisionSuggestionRepository
{
  constructor(private readonly sql: Sql) {}

  async recordPlanRevisionSuggestion(
    suggestion: ReceivedPlanRevisionSuggestion
  ): Promise<StoredPlanRevisionSuggestion> {
    const [row] = await this.sql<PlanRevisionSuggestionRow[]>`
      insert into plan_revision_suggestions (
        plan_id,
        trade_plan_version_id,
        market_key,
        source_event_key,
        revision_action,
        reason,
        changed_fields_json,
        new_invalidation_json,
        new_management_rules_json,
        requires_user_review,
        agent_run_id,
        created_at
      ) values (
        ${suggestion.planId},
        ${suggestion.tradePlanVersionId},
        ${suggestion.marketKey},
        ${suggestion.sourceEventKey},
        ${suggestion.revisionAction},
        ${suggestion.reason},
        ${this.sql.json(suggestion.changedFields)},
        ${suggestion.newInvalidation === null
          ? null
          : this.sql.json(suggestion.newInvalidation)},
        ${this.sql.json(suggestion.newManagementRules)},
        ${suggestion.requiresUserReview},
        ${suggestion.agentRunId},
        ${suggestion.createdAt}
      )
      returning *
    `;

    if (!row) {
      throw new Error("Failed to persist plan revision suggestion");
    }

    return mapPlanRevisionSuggestionRow(row);
  }

  async getLatestPlanRevisionSuggestionByPlanId(
    planId: string
  ): Promise<StoredPlanRevisionSuggestion | null> {
    const [row] = await this.sql<PlanRevisionSuggestionRow[]>`
      select *
      from plan_revision_suggestions
      where plan_id = ${planId}
      order by created_at desc
      limit 1
    `;

    return row ? mapPlanRevisionSuggestionRow(row) : null;
  }

  async listPlanRevisionSuggestionsByPlanId(
    planId: string,
    limit = 20
  ): Promise<StoredPlanRevisionSuggestion[]> {
    const rows = await this.sql<PlanRevisionSuggestionRow[]>`
      select *
      from plan_revision_suggestions
      where plan_id = ${planId}
      order by created_at desc
      limit ${Math.max(1, limit)}
    `;

    return rows.map(mapPlanRevisionSuggestionRow);
  }
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

export function createPlanRevisionSuggestionRepositoryFromEnv(): PostgresPlanRevisionSuggestionRepository {
  return new PostgresPlanRevisionSuggestionRepository(getSharedSqlClientFromEnv());
}
