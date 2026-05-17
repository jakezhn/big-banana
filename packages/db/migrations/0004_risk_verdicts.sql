create table if not exists risk_verdicts (
  id uuid primary key default gen_random_uuid(),
  trade_plan_version_id uuid not null references trade_plan_versions (id),
  trading_account_id text not null,
  verdict text not null check (
    verdict in ('approve', 'approve_with_reduction', 'reject')
  ),
  approved_risk_pct numeric not null,
  approved_qty numeric,
  approved_notional numeric,
  approved_stop_price numeric,
  require_human_approval boolean not null,
  checks_json jsonb not null,
  rejection_codes_json jsonb not null,
  created_at timestamptz not null
);

create index if not exists risk_verdicts_trade_plan_version_idx
  on risk_verdicts (trade_plan_version_id, created_at desc);

create index if not exists risk_verdicts_trading_account_idx
  on risk_verdicts (trading_account_id, created_at desc);
