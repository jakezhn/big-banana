create table if not exists plan_revision_suggestions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  trade_plan_version_id uuid not null references trade_plan_versions (id) on delete cascade,
  market_key text not null,
  source_event_key text not null,
  revision_action text not null check (
    revision_action in (
      'keep',
      'tighten',
      'loosen',
      'downgrade_to_watch',
      'invalidate',
      'upgrade',
      'close_partial',
      'close_full'
    )
  ),
  reason text not null,
  changed_fields_json jsonb not null default '[]'::jsonb,
  new_invalidation_json jsonb,
  new_management_rules_json jsonb not null default '[]'::jsonb,
  requires_user_review boolean not null default false,
  agent_run_id uuid references agent_runs (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists plan_revision_suggestions_plan_id_idx
  on plan_revision_suggestions (plan_id, created_at desc);

create index if not exists plan_revision_suggestions_market_key_idx
  on plan_revision_suggestions (market_key, created_at desc);

alter table plan_revision_suggestions enable row level security;
