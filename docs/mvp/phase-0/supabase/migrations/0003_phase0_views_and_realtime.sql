create or replace view public.v_event_feed as
select
  s.id as snapshot_id,
  s.symbol,
  s.tickerid,
  s.exchange,
  s.timeframe,
  s.timeframe_label,
  s.bar_time,
  s.event_type,
  s.event_direction,
  s.event_level,
  s.event_score,
  s.regime_name,
  s.trend_score,
  s.created_at as snapshot_created_at,
  a.id as analysis_card_id,
  tp.id as trade_plan_id,
  pr.id as latest_plan_review_id
from public.bar_snapshots s
left join public.analysis_cards a
  on a.snapshot_id = s.id
left join lateral (
  select tp1.id
  from public.trade_plans tp1
  where tp1.snapshot_id = s.id
  order by tp1.created_at desc
  limit 1
) tp on true
left join lateral (
  select pr1.id
  from public.plan_reviews pr1
  where pr1.snapshot_id = s.id
  order by pr1.created_at desc
  limit 1
) pr on true;

create or replace view public.v_plan_timeline as
select
  tp.id as trade_plan_id,
  tp.snapshot_id as origin_snapshot_id,
  bs.bar_time as origin_bar_time,
  tp.symbol,
  tp.anchor_timeframe,
  tp.direction,
  tp.status,
  tp.thesis,
  tp.entry_plan,
  tp.take_profit_plan,
  tp.invalidation_plan,
  tp.management_rules,
  tp.expiry_rules,
  tp.confidence,
  tp.previous_plan_id,
  tp.created_at,
  tp.closed_at,
  rp.id as risk_plan_id,
  rp.max_initial_risk_pct,
  rp.size_guidance,
  rp.invalid_if as risk_invalid_if,
  rp.reduce_risk_if,
  rp.exposure_constraints,
  rp.notes as risk_notes,
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'snapshot_id', pr.snapshot_id,
          'action', pr.action,
          'reason', pr.reason,
          'changed_fields', pr.changed_fields,
          'new_status', pr.new_status,
          'revision_trade_plan_id', pr.revision_trade_plan_id,
          'created_at', pr.created_at
        )
        order by pr.created_at asc
      )
      from public.plan_reviews pr
      where pr.trade_plan_id = tp.id
    ),
    '[]'::jsonb
  ) as review_timeline
from public.trade_plans tp
join public.bar_snapshots bs
  on bs.id = tp.snapshot_id
left join public.risk_plans rp
  on rp.trade_plan_id = tp.id;

revoke all on table public.v_event_feed from anon, authenticated;
revoke all on table public.v_plan_timeline from anon, authenticated;

grant select on table public.v_event_feed to authenticated;
grant select on table public.v_plan_timeline to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'bar_snapshots'
  ) then
    alter publication supabase_realtime add table public.bar_snapshots;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'analysis_cards'
  ) then
    alter publication supabase_realtime add table public.analysis_cards;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'trade_plans'
  ) then
    alter publication supabase_realtime add table public.trade_plans;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_publication p on p.oid = pr.prpubid
    join pg_class c on c.oid = pr.prrelid
    join pg_namespace n on n.oid = c.relnamespace
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'plan_reviews'
  ) then
    alter publication supabase_realtime add table public.plan_reviews;
  end if;
end
$$;
