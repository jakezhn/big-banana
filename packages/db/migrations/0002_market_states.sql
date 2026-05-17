create table if not exists market_states_current (
  market_key text primary key,
  webhook_event_id uuid not null references webhook_events (id),
  tickerid text not null,
  timeframe text not null,
  bar_time_ms bigint not null,
  context_json jsonb not null,
  updated_at timestamptz not null
);

create table if not exists market_states_history (
  id uuid primary key default gen_random_uuid(),
  market_key text not null,
  webhook_event_id uuid not null references webhook_events (id),
  tickerid text not null,
  timeframe text not null,
  bar_time_ms bigint not null,
  context_json jsonb not null,
  created_at timestamptz not null,
  unique (tickerid, timeframe, bar_time_ms)
);

create index if not exists market_states_current_bar_time_idx
  on market_states_current (bar_time_ms desc);

create index if not exists market_states_history_market_key_idx
  on market_states_history (market_key, bar_time_ms desc);
