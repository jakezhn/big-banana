alter table public.raw_webhook_events enable row level security;
alter table public.bar_snapshots enable row level security;
alter table public.analysis_cards enable row level security;
alter table public.trade_plans enable row level security;
alter table public.risk_plans enable row level security;
alter table public.plan_reviews enable row level security;

revoke all on table public.raw_webhook_events from anon, authenticated;
revoke all on table public.bar_snapshots from anon, authenticated;
revoke all on table public.analysis_cards from anon, authenticated;
revoke all on table public.trade_plans from anon, authenticated;
revoke all on table public.risk_plans from anon, authenticated;
revoke all on table public.plan_reviews from anon, authenticated;

grant select on table public.raw_webhook_events to authenticated;
grant select on table public.bar_snapshots to authenticated;
grant select on table public.analysis_cards to authenticated;
grant select on table public.trade_plans to authenticated;
grant select on table public.risk_plans to authenticated;
grant select on table public.plan_reviews to authenticated;

create policy "authenticated read raw_webhook_events"
on public.raw_webhook_events
for select
to authenticated
using (true);

create policy "authenticated read bar_snapshots"
on public.bar_snapshots
for select
to authenticated
using (true);

create policy "authenticated read analysis_cards"
on public.analysis_cards
for select
to authenticated
using (true);

create policy "authenticated read trade_plans"
on public.trade_plans
for select
to authenticated
using (true);

create policy "authenticated read risk_plans"
on public.risk_plans
for select
to authenticated
using (true);

create policy "authenticated read plan_reviews"
on public.plan_reviews
for select
to authenticated
using (true);
