create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  market_key text not null,
  source_event_key text not null,
  operation text not null,
  runner_kind text not null,
  model_provider text,
  model text,
  skill_name text not null default 'generate_trade_plan',
  prompt_version text,
  status text not null check (status in ('success', 'invalid_output', 'failed')),
  input_summary_json jsonb not null,
  output_summary_json jsonb,
  token_usage_json jsonb,
  execution_eligible boolean,
  trade_plan_version_id uuid references trade_plan_versions (id),
  error_message text,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  latency_ms integer not null check (latency_ms >= 0)
);

create index if not exists agent_runs_market_key_idx
  on agent_runs (market_key, started_at desc);

create index if not exists agent_runs_source_event_key_idx
  on agent_runs (source_event_key, started_at desc);

create index if not exists agent_runs_operation_idx
  on agent_runs (operation, started_at desc);

alter table agent_runs enable row level security;
