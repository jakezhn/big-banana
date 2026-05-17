import type {
  ExecutionIntentRepository,
  ReceivedExecutionIntent,
  StoredExecutionIntent
} from "@big-banana/domain";
import postgres, { type Sql } from "postgres";

type ExecutionIntentRow = {
  id: string;
  trade_plan_version_id: string;
  risk_verdict_id: string;
  trading_account_id: string;
  payload_json: StoredExecutionIntent["payload"];
  created_at: string;
};

export class PostgresExecutionIntentRepository
  implements ExecutionIntentRepository
{
  constructor(private readonly sql: Sql) {}

  async recordExecutionIntent(
    intent: ReceivedExecutionIntent
  ): Promise<StoredExecutionIntent> {
    const [row] = await this.sql<ExecutionIntentRow[]>`
      insert into execution_intents (
        trade_plan_version_id,
        risk_verdict_id,
        trading_account_id,
        payload_json,
        idempotency_key,
        created_at
      ) values (
        ${intent.tradePlanVersionId},
        ${intent.riskVerdictId},
        ${intent.tradingAccountId},
        ${this.sql.json(intent.payload)},
        ${intent.payload.idempotency_key},
        ${intent.createdAt}
      )
      returning *
    `;

    if (!row) {
      throw new Error("Failed to persist execution intent");
    }

    return {
      id: row.id,
      tradePlanVersionId: row.trade_plan_version_id,
      riskVerdictId: row.risk_verdict_id,
      tradingAccountId: row.trading_account_id,
      payload: row.payload_json,
      createdAt: row.created_at
    };
  }
}

export function createExecutionIntentRepositoryFromEnv(): PostgresExecutionIntentRepository {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  return new PostgresExecutionIntentRepository(postgres(databaseUrl));
}
