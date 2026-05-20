import postgres, { type Sql } from "postgres";

const SQL_CLIENT_KEY = Symbol.for("big-banana.postgres.sql-client");

type GlobalWithSqlClient = typeof globalThis & {
  [SQL_CLIENT_KEY]?: Sql;
};

export function getSharedSqlClientFromEnv(): Sql {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const globalWithSqlClient = globalThis as GlobalWithSqlClient;

  globalWithSqlClient[SQL_CLIENT_KEY] ??= postgres(databaseUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 15
  });

  return globalWithSqlClient[SQL_CLIENT_KEY];
}
