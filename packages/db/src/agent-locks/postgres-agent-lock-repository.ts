import type {
  AgentLockRepository,
  AgentLockScope,
  JsonValue,
  StoredAgentLock
} from "@big-banana/domain";
import { type Sql } from "postgres";
import { getSharedSqlClientFromEnv } from "../sql/shared-sql-client";

type AgentLockRow = {
  lock_key: string;
  scope: AgentLockScope;
  owner_id: string;
  payload_json: JsonValue;
  locked_at: string;
  locked_until: string;
  created_at: string;
  updated_at: string;
};

export class PostgresAgentLockRepository implements AgentLockRepository {
  constructor(private readonly sql: Sql) {}

  async getLock(lockKey: string): Promise<StoredAgentLock | null> {
    const [row] = await this.sql<AgentLockRow[]>`
      select *
      from agent_locks
      where lock_key = ${lockKey}
      limit 1
    `;

    return row ? mapAgentLockRow(row) : null;
  }

  async acquireLock(
    lockKey: string,
    scope: AgentLockScope,
    ownerId: string,
    lockedAt: string,
    lockedUntil: string,
    payloadJson: JsonValue = {}
  ): Promise<StoredAgentLock | null> {
    const [row] = await this.sql<AgentLockRow[]>`
      insert into agent_locks (
        lock_key,
        scope,
        owner_id,
        payload_json,
        locked_at,
        locked_until,
        created_at,
        updated_at
      ) values (
        ${lockKey},
        ${scope},
        ${ownerId},
        ${this.sql.json(payloadJson)},
        ${lockedAt},
        ${lockedUntil},
        ${lockedAt},
        ${lockedAt}
      )
      on conflict (lock_key)
      do update set
        scope = excluded.scope,
        owner_id = excluded.owner_id,
        payload_json = excluded.payload_json,
        locked_at = excluded.locked_at,
        locked_until = excluded.locked_until,
        updated_at = excluded.updated_at
      where agent_locks.locked_until <= excluded.locked_at
         or agent_locks.owner_id = excluded.owner_id
      returning *
    `;

    return row ? mapAgentLockRow(row) : null;
  }

  async renewLock(
    lockKey: string,
    ownerId: string,
    updatedAt: string,
    lockedUntil: string
  ): Promise<StoredAgentLock | null> {
    const [row] = await this.sql<AgentLockRow[]>`
      update agent_locks
      set
        locked_until = ${lockedUntil},
        updated_at = ${updatedAt}
      where lock_key = ${lockKey}
        and owner_id = ${ownerId}
        and locked_until > ${updatedAt}
      returning *
    `;

    return row ? mapAgentLockRow(row) : null;
  }

  async releaseLock(lockKey: string, ownerId: string): Promise<boolean> {
    const rows = await this.sql<Pick<AgentLockRow, "lock_key">[]>`
      delete from agent_locks
      where lock_key = ${lockKey}
        and owner_id = ${ownerId}
      returning lock_key
    `;

    return rows.length > 0;
  }
}

function mapAgentLockRow(row: AgentLockRow): StoredAgentLock {
  return {
    lockKey: row.lock_key,
    scope: row.scope,
    ownerId: row.owner_id,
    payloadJson: row.payload_json,
    lockedAt: row.locked_at,
    lockedUntil: row.locked_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function createAgentLockRepositoryFromEnv(): PostgresAgentLockRepository {
  return new PostgresAgentLockRepository(getSharedSqlClientFromEnv());
}
