-- Security:
-- Enable RLS on all public pipeline tables exposed through PostgREST.
-- No public policies are added in MVP; anonymous/authenticated clients should
-- not access these tables directly. Service-role / direct DB access continues
-- to work because we do not force RLS.
alter table webhook_events enable row level security;
alter table market_states_current enable row level security;
alter table market_states_history enable row level security;
alter table trade_plan_versions enable row level security;
alter table plan_transitions enable row level security;
alter table risk_verdicts enable row level security;
alter table execution_intents enable row level security;
alter table orders enable row level security;

-- Performance:
-- Add covering indexes for foreign keys flagged by the Supabase advisor.
create index if not exists market_states_current_webhook_event_idx
  on market_states_current (webhook_event_id);

create index if not exists market_states_history_webhook_event_idx
  on market_states_history (webhook_event_id);

-- Remove indexes that are not used by the current MVP query paths.
drop index if exists webhook_events_event_key_idx;
drop index if exists webhook_events_received_at_idx;
drop index if exists market_states_history_market_key_idx;
drop index if exists market_states_current_bar_time_idx;
drop index if exists orders_trading_account_idx;
drop index if exists execution_intents_trade_plan_version_idx;
drop index if exists risk_verdicts_trading_account_idx;
drop index if exists plan_transitions_plan_id_idx;
drop index if exists trade_plan_versions_source_event_key_idx;
