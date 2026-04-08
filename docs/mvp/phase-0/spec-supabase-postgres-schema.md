# Supabase Postgres Schema

这份文档定义 Bitpunk MVP 在 Supabase Postgres 上的 Phase 0 数据库方案。

它服务于 3 个目标：

1. 把 [`phase-0-freeze.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/phase-0-freeze.md) 里的表结构草案推进到接近 migration 的级别
2. 明确哪些字段用 enum，哪些字段保留 text / jsonb
3. 明确 Supabase 下的 RLS、Realtime 和 migration 顺序

如果本文和 [`phase-0-freeze.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/phase-0-freeze.md) 有冲突，以本文为准。

---

# 1. 设计前提

Phase 0 的 Supabase 方案基于以下前提：

- 单工作区 MVP
- TradingView webhook 只通过服务端入口写库
- Edge Functions / server actions 使用 service role
- 前端登录后只读，不直接写核心业务表
- 不做多租户隔离

这意味着：

- 当前阶段不引入 `workspace_id`
- 当前阶段不引入 `owner_user_id`
- 当前阶段不允许 browser client 直接写 `raw_webhook_events`、`bar_snapshots`、`analysis_cards`、`trade_plans`、`risk_plans`、`plan_reviews`

如果后续要支持多用户隔离，再在 Phase 1/2 引入 tenant 维度。

---

# 2. Schema 设计原则

## 2.1 内部状态用 enum

以下字段是系统内部有限状态，适合用 PostgreSQL enum：

- ingest status
- analysis status
- suggested bias
- confidence level
- trade plan status
- trade direction
- plan review action

## 2.2 外部 producer 字段先保留 text

以下字段来自 Pine 或后续策略端，Phase 0 保留 `text`：

- `schema_version`
- `timeframe`
- `timeframe_label`
- `event_type`
- `event_direction`
- `regime_name`

原因：

- 这些字段未来更可能扩展
- 用 text 可以减少为外部 schema 变更而频繁改 enum 的成本

## 2.3 深结构先用 jsonb

Phase 0 的 JSONB 原则：

- 前端要整体消费
- SQL 暂时不需要高频逐字段聚合
- 未来字段形状还可能调整

满足这 3 点时，优先放 `jsonb`。

---

# 3. Extensions

Supabase Phase 0 最低要求：

```sql
create extension if not exists pgcrypto;
```

说明：

- 使用 `gen_random_uuid()` 生成主键
- 当前阶段不要求 `pgvector`
- 当前阶段不要求 `pgmq`

---

# 4. Enum 定义

```sql
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
```

---

# 5. 表定义

## 5.1 `raw_webhook_events`

```sql
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
```

设计说明：

- 这是唯一 raw audit 表
- `raw_payload` 永远保留，不做裁剪
- 去重依据是 `(source, dedupe_key)`

## 5.2 `bar_snapshots`

```sql
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
```

设计说明：

- `raw_event_id` 唯一，确保一个 raw 事件最多生成一个 snapshot
- `tickerid + timeframe + bar_time` 唯一，确保业务唯一性
- `momentum / osc / divergence` 先保留 JSONB

## 5.3 `analysis_cards`

```sql
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
```

设计说明：

- Phase 0 约束为一个 snapshot 最多一张 analysis card
- 如果后续支持重跑分析，再引入 version 或 latest pointer

## 5.4 `trade_plans`

```sql
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
```

设计说明：

- Phase 0 不对“同方向只能有一个活跃计划”加数据库强约束
- revision 链用 `previous_plan_id` 连接

## 5.5 `risk_plans`

```sql
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
```

设计说明：

- Phase 0 采用一对一：一个 trade plan 对应一个 risk plan

## 5.6 `plan_reviews`

```sql
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
```

设计说明：

- 每个计划在每个 snapshot 上最多一条 review
- `new_status` 记录 review 后计划应处于的状态

---

# 6. 推荐视图

Phase 0 不强制，但非常建议加两个只读视图，简化前端查询。

## 6.1 `v_event_feed`

用途：

- 供 `/events` 页面直接读取

建议字段：

- snapshot 基础字段
- 对应 `analysis_cards.id`
- 对应 `trade_plans.id`
- 最近 `plan_reviews.id`

## 6.2 `v_plan_timeline`

用途：

- 供 `/plans/[id]` 页面读取

建议内容：

- 计划主信息
- 风控信息
- review 时间线
- 关联 snapshot 时间线

说明：

- 先用 view 拼页面数据，比把页面逻辑全塞到 client 更稳

---

# 7. RLS 策略

## 7.1 基本策略

Phase 0 采用：

- 所有业务表开启 RLS
- `authenticated` 只有 `select`
- browser client 没有 `insert` / `update` / `delete`
- webhook、normalizer、AI writer 都通过 service role 或后端受信执行环境写库

## 7.2 Phase 0 推荐 policy

```sql
alter table public.raw_webhook_events enable row level security;
alter table public.bar_snapshots enable row level security;
alter table public.analysis_cards enable row level security;
alter table public.trade_plans enable row level security;
alter table public.risk_plans enable row level security;
alter table public.plan_reviews enable row level security;

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
```

说明：

- Phase 0 假设登录用户都属于同一个 operator workspace
- 如果你不希望前端读 raw payload，可以不给 `raw_webhook_events` 开放 select，而改由 server component 拉取

## 7.3 更保守的替代方案

如果你想让原始 payload 只有服务端可见：

- 不给 `raw_webhook_events` 建任何 `authenticated select` policy
- 前端 event detail 里的 raw JSON 通过 server route 按需返回

这个方案在安全上更干净。

---

# 8. Realtime 配置

Phase 0 建议只把真正需要推送到前端的表加入 Realtime：

- `bar_snapshots`
- `analysis_cards`
- `trade_plans`
- `plan_reviews`

不建议加：

- `raw_webhook_events`
- `risk_plans`

推荐原因：

- `raw_webhook_events` 主要用于调试，不值得推送
- `risk_plans` 通常和 `trade_plans` 一起读取，不需要单独实时刷

示意：

```sql
alter publication supabase_realtime add table public.bar_snapshots;
alter publication supabase_realtime add table public.analysis_cards;
alter publication supabase_realtime add table public.trade_plans;
alter publication supabase_realtime add table public.plan_reviews;
```

---

# 9. Migration 顺序

推荐 migration 顺序：

1. `pgcrypto`
2. enums
3. `raw_webhook_events`
4. `bar_snapshots`
5. `analysis_cards`
6. `trade_plans`
7. `risk_plans`
8. `plan_reviews`
9. views
10. RLS
11. Realtime publication

原因：

- 先建最底层数据入口
- 再建 snapshot
- 再建 AI 产物表
- 最后再建权限和推送

---

# 10. Phase 0 不进入主 schema 的表

以下表在当前阶段先不进主 schema：

- `multi_tf_contexts`
- `plan_candidates`
- `positions_simulated`
- `risk_events`
- `llm_runs`
- `system_prompt_versions`

原因：

- 这些表会让 MVP 复杂度明显上升
- 当前主链路先是 ingest -> normalize -> analyze -> plan -> review -> display
- 等 Phase 1/2 真的遇到可观测性或 prompt 版本管理痛点，再加更稳

其中最可能优先补的是：

1. `llm_runs`
2. `system_prompt_versions`

---

# 11. 从本文到 SQL migration 的映射

Phase 0 之后，下一步建议直接产出：

1. `supabase/migrations/0001_phase0_base_schema.sql`
2. `supabase/migrations/0002_phase0_rls.sql`
3. `supabase/migrations/0003_phase0_views_and_realtime.sql`

这样会比把所有内容塞进一份 migration 更容易 review。

---

# 12. 结论

Phase 0 的 Supabase/Postgres 主 schema 就冻结为 6 张表：

- `raw_webhook_events`
- `bar_snapshots`
- `analysis_cards`
- `trade_plans`
- `risk_plans`
- `plan_reviews`

其中：

- bounded internal states 用 enum
- 外部 producer 字段保留 text
- 深结构先用 jsonb
- 前端默认只读
- 写操作全部走服务端

这套设计足够支持当前 MVP，也保留了后续继续扩展成多周期、模拟执行、prompt 版本化的空间。
