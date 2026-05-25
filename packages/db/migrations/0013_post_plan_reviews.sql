create table if not exists post_plan_reviews (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  trade_plan_version_id uuid not null references trade_plan_versions (id) on delete cascade,
  market_key text not null,
  source_event_key text not null,
  outcome_summary text not null,
  what_worked_json jsonb not null default '[]'::jsonb,
  what_failed_json jsonb not null default '[]'::jsonb,
  missed_context_json jsonb not null default '[]'::jsonb,
  early_warning_signals_json jsonb not null default '[]'::jsonb,
  lesson_candidates_json jsonb not null default '[]'::jsonb,
  should_update_strategy_memory boolean not null default false,
  agent_run_id uuid references agent_runs (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists post_plan_reviews_plan_id_idx
  on post_plan_reviews (plan_id, created_at desc);

create index if not exists post_plan_reviews_market_key_idx
  on post_plan_reviews (market_key, created_at desc);

alter table post_plan_reviews enable row level security;
