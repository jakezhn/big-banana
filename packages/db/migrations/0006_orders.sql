create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  execution_intent_id uuid not null references execution_intents (id),
  trading_account_id text not null,
  venue text not null,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  order_type text not null check (order_type in ('limit', 'market', 'conditional')),
  time_in_force text not null check (time_in_force in ('GTC', 'IOC', 'FOK', 'PostOnly')),
  reduce_only boolean not null,
  client_order_id text not null,
  exchange_order_id text,
  status text not null,
  requested_qty numeric not null,
  requested_price numeric,
  stop_price numeric,
  avg_fill_price numeric,
  filled_qty numeric not null default 0,
  submitted_at timestamptz not null,
  last_exchange_update_at timestamptz not null,
  terminal_at timestamptz,
  raw_exchange_json jsonb not null,
  unique (venue, client_order_id)
);

create index if not exists orders_execution_intent_idx
  on orders (execution_intent_id, submitted_at desc);

create index if not exists orders_trading_account_idx
  on orders (trading_account_id, submitted_at desc);
