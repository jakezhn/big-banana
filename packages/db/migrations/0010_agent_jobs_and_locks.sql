create table if not exists agent_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null check (status in ('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout')),
  market text not null,
  symbol text,
  timeframe text,
  signal_id text,
  plan_id text,
  priority integer not null default 5 check (priority >= 0),
  idempotency_key text not null unique,
  payload_json jsonb not null default '{}'::jsonb,
  result_ref_json jsonb,
  locked_by text,
  locked_at timestamptz,
  locked_until timestamptz,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  run_after timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_jobs_claim_idx
  on agent_jobs (status, priority asc, run_after asc, created_at asc);

create index if not exists agent_jobs_market_symbol_idx
  on agent_jobs (market, symbol, timeframe, created_at desc);

create index if not exists agent_jobs_locked_until_idx
  on agent_jobs (locked_until)
  where status = 'running';

create table if not exists agent_locks (
  lock_key text primary key,
  scope text not null check (scope in ('symbol', 'plan', 'risk', 'execution')),
  owner_id text not null,
  payload_json jsonb not null default '{}'::jsonb,
  locked_at timestamptz not null,
  locked_until timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agent_locks_scope_idx
  on agent_locks (scope, locked_until asc);

alter table agent_jobs enable row level security;
alter table agent_locks enable row level security;
