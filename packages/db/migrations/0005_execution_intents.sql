create table if not exists execution_intents (
  id uuid primary key default gen_random_uuid(),
  trade_plan_version_id uuid not null references trade_plan_versions (id),
  risk_verdict_id uuid not null references risk_verdicts (id),
  trading_account_id text not null,
  payload_json jsonb not null,
  idempotency_key text not null unique,
  created_at timestamptz not null
);

create index if not exists execution_intents_trade_plan_version_idx
  on execution_intents (trade_plan_version_id, created_at desc);

create index if not exists execution_intents_risk_verdict_idx
  on execution_intents (risk_verdict_id, created_at desc);
