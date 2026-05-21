create table if not exists fills (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders (id),
  execution_intent_id uuid not null references execution_intents (id),
  trading_account_id text not null,
  venue text not null,
  symbol text not null,
  side text not null check (side in ('buy', 'sell')),
  qty numeric not null,
  price numeric not null,
  filled_at timestamptz not null,
  exchange_fill_id text not null,
  raw_exchange_json jsonb not null,
  unique (venue, exchange_fill_id)
);

create index if not exists fills_order_idx
  on fills (order_id, filled_at desc);

create index if not exists fills_symbol_idx
  on fills (trading_account_id, symbol, filled_at desc);

create table if not exists positions_current (
  id uuid primary key default gen_random_uuid(),
  trading_account_id text not null,
  symbol text not null,
  market_key text not null,
  position_side text not null check (position_side in ('long', 'short', 'flat')),
  signed_qty numeric not null,
  avg_entry_price numeric,
  opened_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null,
  last_fill_id uuid not null references fills (id),
  unique (trading_account_id, symbol)
);

create index if not exists positions_current_market_key_idx
  on positions_current (market_key, updated_at desc);

create table if not exists positions_history (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references positions_current (id),
  trading_account_id text not null,
  symbol text not null,
  market_key text not null,
  position_side text not null check (position_side in ('long', 'short', 'flat')),
  signed_qty numeric not null,
  avg_entry_price numeric,
  source_fill_id uuid not null references fills (id),
  event_type text not null check (event_type in ('open', 'increase', 'reduce', 'close', 'flip')),
  recorded_at timestamptz not null
);

create index if not exists positions_history_position_idx
  on positions_history (position_id, recorded_at desc);

alter table fills enable row level security;
alter table positions_current enable row level security;
alter table positions_history enable row level security;
