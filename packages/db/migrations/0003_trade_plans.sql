create table if not exists trade_plan_versions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  version integer not null check (version > 0),
  market_key text not null,
  source_event_key text not null,
  action text not null check (action in ('create', 'keep', 'patch', 'terminate', 'skip')),
  market_thesis_json jsonb not null,
  execution_playbook_json jsonb not null,
  risk_intent_json jsonb not null,
  reasoning_summary text not null,
  evidence_json jsonb not null,
  created_at timestamptz not null,
  unique (plan_id, version)
);

create table if not exists plan_transitions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  version integer not null,
  from_state text,
  to_state text not null check (
    to_state in (
      'watch',
      'armed',
      'pending_entry',
      'entered',
      'managing',
      'exit_only',
      'closed',
      'invalidated',
      'expired'
    )
  ),
  reason_code text not null,
  created_at timestamptz not null,
  unique (plan_id, version, to_state),
  foreign key (plan_id, version)
    references trade_plan_versions (plan_id, version)
);

create index if not exists trade_plan_versions_market_key_idx
  on trade_plan_versions (market_key, created_at desc);

create index if not exists trade_plan_versions_source_event_key_idx
  on trade_plan_versions (source_event_key);

create index if not exists plan_transitions_plan_id_idx
  on plan_transitions (plan_id, version desc);
