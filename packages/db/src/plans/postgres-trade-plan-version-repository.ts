import type {
  ReceivedPlanTransition,
  ReceivedTradePlanVersion,
  StoredPlanTransition,
  StoredTradePlanVersion,
  TradePlanVersionRepository
} from "@big-banana/domain";
import { type Sql } from "postgres";
import { getSharedSqlClientFromEnv } from "../sql/shared-sql-client";

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

type PlanTransitionRow = {
  id: string;
  plan_id: string;
  version: number;
  from_state: StoredPlanTransition["fromState"];
  to_state: StoredPlanTransition["toState"];
  reason_code: string;
  created_at: string;
};

export class PostgresTradePlanVersionRepository
  implements TradePlanVersionRepository
{
  constructor(private readonly sql: Sql) {}

  async getLatestTradePlanVersion(
    planId: string
  ): Promise<StoredTradePlanVersion | null> {
    const [row] = await this.sql<TradePlanVersionRow[]>`
      select *
      from trade_plan_versions
      where plan_id = ${planId}
      order by version desc
      limit 1
    `;

    return row ? mapTradePlanVersionRow(row) : null;
  }

  async getLatestTradePlanVersionByMarketKey(
    marketKey: string
  ): Promise<StoredTradePlanVersion | null> {
    const [row] = await this.sql<TradePlanVersionRow[]>`
      select *
      from trade_plan_versions
      where market_key = ${marketKey}
      order by created_at desc, version desc
      limit 1
    `;

    return row ? mapTradePlanVersionRow(row) : null;
  }

  async recordTradePlanVersion(
    version: ReceivedTradePlanVersion
  ): Promise<StoredTradePlanVersion> {
    const [row] = await this.sql<TradePlanVersionRow[]>`
      insert into trade_plan_versions (
        plan_id,
        version,
        market_key,
        source_event_key,
        action,
        market_thesis_json,
        execution_playbook_json,
        risk_intent_json,
        reasoning_summary,
        evidence_json,
        created_at
      ) values (
        ${version.planId},
        ${version.version},
        ${version.marketKey},
        ${version.sourceEventKey},
        ${version.action},
        ${this.sql.json(version.marketThesis)},
        ${this.sql.json(version.executionPlaybook)},
        ${this.sql.json(version.riskIntent)},
        ${version.reasoningSummary},
        ${this.sql.json(version.evidence)},
        ${version.createdAt}
      )
      returning *
    `;

    if (!row) {
      throw new Error("Failed to persist trade plan version");
    }

    return mapTradePlanVersionRow(row);
  }

  async recordPlanTransition(
    transition: ReceivedPlanTransition
  ): Promise<StoredPlanTransition> {
    const [row] = await this.sql<PlanTransitionRow[]>`
      insert into plan_transitions (
        plan_id,
        version,
        from_state,
        to_state,
        reason_code,
        created_at
      ) values (
        ${transition.planId},
        ${transition.version},
        ${transition.fromState},
        ${transition.toState},
        ${transition.reasonCode},
        ${transition.createdAt}
      )
      returning *
    `;

    if (!row) {
      throw new Error("Failed to persist plan transition");
    }

    return {
      id: row.id,
      planId: row.plan_id,
      version: row.version,
      fromState: row.from_state,
      toState: row.to_state,
      reasonCode: row.reason_code,
      createdAt: row.created_at
    };
  }
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

export function createTradePlanVersionRepositoryFromEnv(): PostgresTradePlanVersionRepository {
  return new PostgresTradePlanVersionRepository(getSharedSqlClientFromEnv());
}
