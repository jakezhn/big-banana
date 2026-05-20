import type {
  ReceivedRiskVerdict,
  RiskVerdictRepository,
  StoredRiskVerdict
} from "@big-banana/domain";
import { type Sql } from "postgres";
import { getSharedSqlClientFromEnv } from "../sql/shared-sql-client";

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

export class PostgresRiskVerdictRepository implements RiskVerdictRepository {
  constructor(private readonly sql: Sql) {}

  async recordRiskVerdict(
    verdict: ReceivedRiskVerdict
  ): Promise<StoredRiskVerdict> {
    const [row] = await this.sql<RiskVerdictRow[]>`
      insert into risk_verdicts (
        trade_plan_version_id,
        trading_account_id,
        verdict,
        approved_risk_pct,
        approved_qty,
        approved_notional,
        approved_stop_price,
        require_human_approval,
        checks_json,
        rejection_codes_json,
        created_at
      ) values (
        ${verdict.tradePlanVersionId},
        ${verdict.tradingAccountId},
        ${verdict.verdict},
        ${verdict.approvedRiskPct},
        ${verdict.approvedQty},
        ${verdict.approvedNotional},
        ${verdict.approvedStopPrice},
        ${verdict.requireHumanApproval},
        ${this.sql.json(verdict.checks)},
        ${this.sql.json(verdict.rejectionCodes)},
        ${verdict.createdAt}
      )
      returning *
    `;

    if (!row) {
      throw new Error("Failed to persist risk verdict");
    }

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
}

export function createRiskVerdictRepositoryFromEnv(): PostgresRiskVerdictRepository {
  return new PostgresRiskVerdictRepository(getSharedSqlClientFromEnv());
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
