create table if not exists memory_lesson_candidates (
  id uuid primary key default gen_random_uuid(),
  post_plan_review_id uuid not null references post_plan_reviews(id) on delete cascade,
  plan_id uuid not null,
  trade_plan_version_id uuid not null references trade_plan_versions(id) on delete cascade,
  market_key text not null,
  source_event_key text not null,
  lesson text not null,
  scope_market text not null,
  scope_asset_class text,
  scope_symbol text,
  scope_timeframe text,
  scope_regime text,
  scope_signal_type text,
  confidence numeric not null,
  sample_size integer not null check (sample_size > 0),
  decay_days integer not null check (decay_days > 0),
  retrieval_hint text not null,
  status text not null check (status in ('pending_review', 'accepted', 'rejected')),
  agent_run_id uuid references agent_runs(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists memory_lesson_candidates_review_idx
  on memory_lesson_candidates (post_plan_review_id, created_at desc);

create index if not exists memory_lesson_candidates_market_scope_idx
  on memory_lesson_candidates (scope_market, scope_symbol, scope_timeframe, created_at desc);

alter table memory_lesson_candidates enable row level security;
