create extension if not exists pgcrypto;

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  schema_version text not null,
  delivery_key text not null unique,
  payload_hash text not null,
  event_key text not null,
  tickerid text not null,
  timeframe text not null,
  bar_time_ms bigint not null,
  event_type text not null check (event_type in ('snapshot', 'signal')),
  raw_payload jsonb not null,
  received_at timestamptz not null,
  last_received_at timestamptz not null,
  delivery_count integer not null default 1 check (delivery_count > 0),
  process_status text not null default 'received'
);

create index if not exists webhook_events_event_key_idx
  on webhook_events (event_key);

create index if not exists webhook_events_received_at_idx
  on webhook_events (received_at desc);
