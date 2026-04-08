create extension if not exists pgcrypto;

create type public.ingest_status as enum (
  'accepted',
  'rejected',
  'duplicated'
);

create type public.analysis_status as enum (
  'pending',
  'completed',
  'failed'
);

create type public.bias_type as enum (
  'long',
  'short',
  'neutral',
  'wait'
);

create type public.confidence_level as enum (
  'low',
  'medium',
  'high'
);

create type public.trade_direction as enum (
  'long',
  'short'
);

create type public.trade_plan_status as enum (
  'drafted',
  'active_waiting_entry',
  'active_entered',
  'active_scaling_out',
  'closed_tp',
  'closed_sl',
  'closed_manual_rule',
  'invalidated',
  'expired'
);

create type public.plan_review_action as enum (
  'keep',
  'modify',
  'reduce_risk',
  'partial_take_profit',
  'invalidate',
  'close_plan'
);

create table public.raw_webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'tradingview',
  schema_version text not null,
  dedupe_key text not null,
  received_at timestamptz not null default now(),
  raw_payload jsonb not null,
  ingest_status public.ingest_status not null,
  error_message text null,
  constraint raw_webhook_events_source_check
    check (source <> '')
);

create unique index raw_webhook_events_source_dedupe_key_uniq
  on public.raw_webhook_events (source, dedupe_key);

create index raw_webhook_events_received_at_idx
  on public.raw_webhook_events (received_at desc);

create index raw_webhook_events_schema_version_idx
  on public.raw_webhook_events (schema_version);

create table public.bar_snapshots (
  id uuid primary key default gen_random_uuid(),
  raw_event_id uuid not null references public.raw_webhook_events(id) on delete cascade,

  symbol text not null,
  tickerid text not null,
  exchange text not null,
  timeframe text not null,
  timeframe_label text not null,
  bar_time timestamptz not null,
  confirmed boolean not null default true,

  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume numeric null,

  event_type text not null,
  event_direction text not null,
  event_level integer null,
  event_score numeric null,

  regime_name text not null,
  trend_score numeric null,

  ema20 numeric null,
  ema50 numeric null,
  ema100 numeric null,
  ema200 numeric null,
  relative_high numeric null,
  relative_low numeric null,

  peak_nodes jsonb not null default '[]'::jsonb,
  trough_nodes jsonb not null default '[]'::jsonb,

  signal_bull_level integer null,
  signal_bull_score numeric null,
  signal_bull_new_fire boolean not null default false,
  signal_bull_update_fire boolean not null default false,
  signal_bear_level integer null,
  signal_bear_score numeric null,
  signal_bear_new_fire boolean not null default false,
  signal_bear_update_fire boolean not null default false,

  context_bull_active boolean not null default false,
  context_bull_score numeric null,
  context_bull_strong boolean not null default false,
  context_bear_active boolean not null default false,
  context_bear_score numeric null,
  context_bear_strong boolean not null default false,
  context_breakdown jsonb not null default '{}'::jsonb,

  momentum jsonb not null default '{}'::jsonb,
  osc jsonb not null default '{}'::jsonb,
  divergence jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  constraint bar_snapshots_price_check
    check (high >= low),
  constraint bar_snapshots_peak_nodes_is_array_check
    check (jsonb_typeof(peak_nodes) = 'array'),
  constraint bar_snapshots_trough_nodes_is_array_check
    check (jsonb_typeof(trough_nodes) = 'array'),
  constraint bar_snapshots_context_breakdown_is_object_check
    check (jsonb_typeof(context_breakdown) = 'object'),
  constraint bar_snapshots_momentum_is_object_check
    check (jsonb_typeof(momentum) = 'object'),
  constraint bar_snapshots_osc_is_object_check
    check (jsonb_typeof(osc) = 'object'),
  constraint bar_snapshots_divergence_is_object_check
    check (jsonb_typeof(divergence) = 'object')
);

create unique index bar_snapshots_tickerid_timeframe_bar_time_uniq
  on public.bar_snapshots (tickerid, timeframe, bar_time);

create unique index bar_snapshots_raw_event_id_uniq
  on public.bar_snapshots (raw_event_id);

create index bar_snapshots_symbol_timeframe_label_bar_time_idx
  on public.bar_snapshots (symbol, timeframe_label, bar_time desc);

create index bar_snapshots_event_type_bar_time_idx
  on public.bar_snapshots (event_type, bar_time desc);

create index bar_snapshots_regime_name_bar_time_idx
  on public.bar_snapshots (regime_name, bar_time desc);

create table public.analysis_cards (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.bar_snapshots(id) on delete cascade,
  status public.analysis_status not null default 'pending',
  summary_line text not null,
  detailed_explanation text not null,
  suggested_bias public.bias_type not null,
  confidence public.confidence_level not null,
  risks jsonb not null default '[]'::jsonb,
  model_name text not null,
  raw_response jsonb null,
  created_at timestamptz not null default now(),

  constraint analysis_cards_risks_is_array_check
    check (jsonb_typeof(risks) = 'array')
);

create unique index analysis_cards_snapshot_id_uniq
  on public.analysis_cards (snapshot_id);

create index analysis_cards_created_at_idx
  on public.analysis_cards (created_at desc);

create table public.trade_plans (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.bar_snapshots(id) on delete restrict,
  symbol text not null,
  anchor_timeframe text not null,
  direction public.trade_direction not null,
  status public.trade_plan_status not null,
  thesis jsonb not null,
  entry_plan jsonb not null,
  take_profit_plan jsonb not null,
  invalidation_plan jsonb not null,
  management_rules jsonb not null default '[]'::jsonb,
  expiry_rules jsonb not null default '[]'::jsonb,
  confidence public.confidence_level not null,
  previous_plan_id uuid null references public.trade_plans(id) on delete restrict,
  created_at timestamptz not null default now(),
  closed_at timestamptz null,

  constraint trade_plans_thesis_is_object_check
    check (jsonb_typeof(thesis) = 'object'),
  constraint trade_plans_entry_plan_is_object_check
    check (jsonb_typeof(entry_plan) = 'object'),
  constraint trade_plans_take_profit_plan_is_object_check
    check (jsonb_typeof(take_profit_plan) = 'object'),
  constraint trade_plans_invalidation_plan_is_object_check
    check (jsonb_typeof(invalidation_plan) = 'object'),
  constraint trade_plans_management_rules_is_array_check
    check (jsonb_typeof(management_rules) = 'array'),
  constraint trade_plans_expiry_rules_is_array_check
    check (jsonb_typeof(expiry_rules) = 'array')
);

create index trade_plans_symbol_anchor_timeframe_created_at_idx
  on public.trade_plans (symbol, anchor_timeframe, created_at desc);

create index trade_plans_status_created_at_idx
  on public.trade_plans (status, created_at desc);

create index trade_plans_previous_plan_id_idx
  on public.trade_plans (previous_plan_id);

create index trade_plans_snapshot_id_idx
  on public.trade_plans (snapshot_id);

create table public.risk_plans (
  id uuid primary key default gen_random_uuid(),
  trade_plan_id uuid not null references public.trade_plans(id) on delete cascade,
  max_initial_risk_pct numeric not null,
  size_guidance text not null,
  invalid_if jsonb not null default '[]'::jsonb,
  reduce_risk_if jsonb not null default '[]'::jsonb,
  exposure_constraints jsonb not null default '[]'::jsonb,
  notes text null,
  created_at timestamptz not null default now(),

  constraint risk_plans_max_initial_risk_pct_check
    check (max_initial_risk_pct > 0),
  constraint risk_plans_invalid_if_is_array_check
    check (jsonb_typeof(invalid_if) = 'array'),
  constraint risk_plans_reduce_risk_if_is_array_check
    check (jsonb_typeof(reduce_risk_if) = 'array'),
  constraint risk_plans_exposure_constraints_is_array_check
    check (jsonb_typeof(exposure_constraints) = 'array')
);

create unique index risk_plans_trade_plan_id_uniq
  on public.risk_plans (trade_plan_id);

create table public.plan_reviews (
  id uuid primary key default gen_random_uuid(),
  trade_plan_id uuid not null references public.trade_plans(id) on delete cascade,
  snapshot_id uuid not null references public.bar_snapshots(id) on delete cascade,
  action public.plan_review_action not null,
  reason text not null,
  changed_fields jsonb not null default '[]'::jsonb,
  new_status public.trade_plan_status not null,
  revision_trade_plan_id uuid null references public.trade_plans(id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint plan_reviews_changed_fields_is_array_check
    check (jsonb_typeof(changed_fields) = 'array')
);

create unique index plan_reviews_trade_plan_id_snapshot_id_uniq
  on public.plan_reviews (trade_plan_id, snapshot_id);

create index plan_reviews_created_at_idx
  on public.plan_reviews (created_at desc);

create index plan_reviews_action_created_at_idx
  on public.plan_reviews (action, created_at desc);

create index plan_reviews_snapshot_id_idx
  on public.plan_reviews (snapshot_id);
