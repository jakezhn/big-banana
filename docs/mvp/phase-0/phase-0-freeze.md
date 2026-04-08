# Phase 0 Freeze

这份文档用于冻结 Phase 0 的产品边界、命名、对象、页面与数据库草案。

它的作用不是替代以下文档，而是作为它们之上的“收口文档”：

- [`design-mvp-v0.1.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/design-mvp-v0.1.md)
- [`spec-webhook-payload.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/spec-webhook-payload.md)
- [`spec-trading-pipeline.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/spec-trading-pipeline.md)

如果这三份文档和本文有冲突，以本文为准。

---

# 1. Phase 0 的冻结目标

Phase 0 只做 4 件事：

1. 冻结 MVP 页面清单
2. 冻结核心对象命名与边界
3. 冻结 webhook 输入边界与 normalized 输出边界
4. 冻结 Supabase 表结构草案

Phase 0 不做：

- 具体实现
- prompt 细化
- 最终 SQL migration
- UI 视觉稿
- 真正交易执行
- 回测系统
- 多 agent 编排

---

# 2. MVP 功能边界

当前 MVP 冻结为以下主链路：

**TradingView Webhook -> Supabase Edge Function -> Postgres -> OpenAI -> Next.js Dashboard**

MVP 必须覆盖：

- webhook 接收
- 原始 payload 存储
- 规范化后的市场快照
- 单事件分析卡片
- 交易计划
- 风控计划
- 基于新 bar 的计划评审
- 时间线式阅读体验

MVP 明确不覆盖：

- 自动下单
- 独立 worker / queue 系统
- LangGraph 或多 agent
- 高频回测
- 多交易所统一执行层

---

# 3. 命名冻结

## 3.1 统一原则

Phase 0 之后，统一区分 3 层命名：

- 产品概念名：给文档和页面使用
- 对象名：给代码和 AI schema 使用
- 表名：给数据库使用

## 3.2 核心对象命名

以下 6 个对象是 Phase 0 的 canonical names：

1. `raw_webhook_event`
2. `normalized_bar_snapshot`
3. `analysis_card`
4. `trade_plan`
5. `risk_plan`
6. `plan_review`

说明：

- `design-mvp-v0.1.md` 中较宽泛的 `raw_event`，冻结为 `raw_webhook_event`
- `design-mvp-v0.1.md` 中较宽泛的 `normalized_event`，冻结为 `normalized_bar_snapshot`
- `multi_timeframe_market_context` 是派生上下文对象，不是 Phase 0 的核心持久化对象

## 3.3 数据表命名

Phase 0 冻结以下表名：

- `raw_webhook_events`
- `bar_snapshots`
- `analysis_cards`
- `trade_plans`
- `risk_plans`
- `plan_reviews`

说明：

- 对象名用单数
- 表名用复数
- 后续不要再在文档里混用 `events`、`normalized_events`、`raw_events` 这类不精确名字

---

# 4. Webhook 输入边界冻结

## 4.1 外部输入 schema

当前系统接收的外部 producer schema 冻结为：

- `schema_version = bitpunk.webhook.v9`

这意味着：

- Phase 0 不再额外发明一个新的 Pine webhook schema 名称
- `design-mvp-v0.1.md` 里提到的 “schema v1”，在当前阶段解释为“系统内部冻结的接入版本”，不是要求 Pine 端马上改名
- 只要 Pine 实际输出还是 `bitpunk.webhook.v9`，系统就按该版本解析

如果后续 Pine payload 改版：

- 先更新 `spec-webhook-payload.md`
- 再评估是否升级 ingestion parser

## 4.2 外部输入读取顺序

系统在分析时，读取顺序冻结为：

1. `summary.market`
2. `summary.event`
3. `summary.regime`
4. `summary.structure`
5. `detail.signal`
6. `detail.context`
7. `detail.momentum`
8. `detail.osc`
9. `detail.divergence`

这个顺序会继续沿用到：

- normalizer
- rule engine
- analysis input builder
- LLM prompt assembly

## 4.3 去重规则

Phase 0 的 webhook 去重规则冻结为：

- 不使用 `bar_index` 作为稳定主键
- 以 `tickerid + timeframe + bar_time` 作为业务唯一锚点

推荐 `dedupe_key` 组成：

```txt
tradingview:{tickerid}:{timeframe}:{bar_time}
```

例如：

```txt
tradingview:BINANCE:BTCUSDT:240:2026-04-08T08:00:00Z
```

原因：

- `bar_time` 是跨系统稳定时间锚
- `tickerid` 已区分交易所与交易对
- 当前 payload 只在 confirmed close 发出
- Phase 0 默认同一 `tickerid + timeframe + bar_time` 只应有一条有效 raw event

---

# 5. Normalized 输出边界冻结

## 5.1 `normalized_bar_snapshot` 的职责

`normalized_bar_snapshot` 只做一件事：

- 把 webhook 的原始语义整理成前端和 AI 都可直接消费的标准市场快照

它不负责：

- 最终建不建计划
- 最终方向判断
- 风控裁决
- LLM 生成文本

## 5.2 `normalized_bar_snapshot` 的最小字段范围

Phase 0 冻结以下字段组：

- identity
  - `id`
  - `raw_event_id`
  - `symbol`
  - `tickerid`
  - `exchange`
  - `timeframe`
  - `timeframe_label`
  - `bar_time`
  - `confirmed`
- market
  - `open`
  - `high`
  - `low`
  - `close`
  - `volume`
- event
  - `event_type`
  - `event_direction`
  - `event_level`
  - `event_score`
- regime
  - `regime_name`
  - `trend_score`
- structure
  - `ema20`
  - `ema50`
  - `ema100`
  - `ema200`
  - `relative_high`
  - `relative_low`
  - `peak_nodes`
  - `trough_nodes`
- signal detail
  - `signal_bull_level`
  - `signal_bull_score`
  - `signal_bull_new_fire`
  - `signal_bull_update_fire`
  - `signal_bear_level`
  - `signal_bear_score`
  - `signal_bear_new_fire`
  - `signal_bear_update_fire`
- context detail
  - `context_bull_active`
  - `context_bull_score`
  - `context_bull_strong`
  - `context_bear_active`
  - `context_bear_score`
  - `context_bear_strong`
  - `context_breakdown`
- momentum / osc / divergence
  - `momentum`
  - `osc`
  - `divergence`

其中：

- 高频访问和筛选字段，优先拆成标量列
- 结构较深、变化可能较大的部分，可以先放 JSONB

## 5.3 JSONB 边界

Phase 0 推荐以下 JSONB 边界：

- `peak_nodes jsonb`
- `trough_nodes jsonb`
- `context_breakdown jsonb`
- `momentum jsonb`
- `osc jsonb`
- `divergence jsonb`

这样可以兼顾：

- 前端直接消费
- SQL 基础筛选
- 后续 schema 微调时不必频繁迁移

---

# 6. 页面清单冻结

Phase 0 冻结 4 个 MVP 页面。

## 6.1 `/`

页面名：

- Dashboard

最小内容块：

- 最近事件概览
- 活跃计划概览
- 最近评审概览
- 关键过滤器入口

Phase 0 不要求：

- 复杂图表
- 自定义布局系统

## 6.2 `/events`

页面名：

- Event Feed

最小内容块：

- 事件流列表
- 按 `symbol` / `timeframe_label` / `event_direction` / `regime_name` 过滤
- 最新状态标签
- 跳转到事件详情页

## 6.3 `/events/[id]`

页面名：

- Event Detail

最小内容块：

- 原始市场快照摘要
- `summary` 与 `detail` 的可读展示
- 原始 JSON viewer
- 该事件对应的 `analysis_card`
- 该事件触发的 `trade_plan` / `risk_plan` / `plan_review`

## 6.4 `/plans/[id]`

页面名：

- Plan Timeline

最小内容块：

- 计划当前状态
- 计划 thesis / entry / invalidation / TP / management
- 风控约束
- 所有关联 review 卡片
- 从创建到关闭的时间线

说明：

- Phase 0 只冻结到 plan detail timeline
- 不单独要求 `/plans` 列表页

---

# 7. 核心对象冻结

## 7.1 `raw_webhook_event`

职责：

- 保存 TradingView 原始入站 payload
- 提供审计、调试、重放依据

最小字段：

```json
{
  "id": "uuid",
  "source": "tradingview",
  "schema_version": "bitpunk.webhook.v9",
  "dedupe_key": "string",
  "received_at": "timestamp",
  "raw_payload": {},
  "ingest_status": "accepted | rejected | duplicated",
  "error_message": "string | null"
}
```

## 7.2 `normalized_bar_snapshot`

职责：

- 表示一个 confirmed close bar 的标准化市场状态

最小约束：

- 一个 `raw_webhook_event` 最多生成一个 `normalized_bar_snapshot`
- 一个 `tickerid + timeframe + bar_time` 最多对应一个 `normalized_bar_snapshot`

## 7.3 `analysis_card`

职责：

- 对单个 `normalized_bar_snapshot` 生成一张可读分析卡

最小字段：

```json
{
  "id": "uuid",
  "snapshot_id": "uuid",
  "status": "pending | completed | failed",
  "summary_line": "string",
  "detailed_explanation": "string",
  "suggested_bias": "long | short | neutral | wait",
  "confidence": "low | medium | high",
  "risks": ["string"],
  "model_name": "string",
  "created_at": "timestamp"
}
```

冻结原则：

- Phase 0 只做单事件分析
- 不做多轮对话 history
- 不做 analyst agent memory

## 7.4 `trade_plan`

职责：

- 基于当前市场状态形成结构化交易计划

最小字段：

```json
{
  "id": "uuid",
  "snapshot_id": "uuid",
  "status": "drafted | active_waiting_entry | active_entered | active_scaling_out | closed_tp | closed_sl | closed_manual_rule | invalidated | expired",
  "symbol": "string",
  "anchor_timeframe": "string",
  "direction": "long | short",
  "thesis": {},
  "entry_plan": {},
  "take_profit_plan": {},
  "invalidation_plan": {},
  "management_rules": [],
  "expiry_rules": [],
  "confidence": "low | medium | high",
  "created_at": "timestamp",
  "closed_at": "timestamp | null"
}
```

冻结原则：

- `trade_plan` 是主对象
- 计划生命周期状态以它为准
- review 产生修改时，不直接覆盖历史，应保留 revision 轨迹

## 7.5 `risk_plan`

职责：

- 把风控约束显式化，而不是散落在 `trade_plan` 文本里

最小字段：

```json
{
  "id": "uuid",
  "trade_plan_id": "uuid",
  "max_initial_risk_pct": "number",
  "size_guidance": "string",
  "invalid_if": ["string"],
  "reduce_risk_if": ["string"],
  "exposure_constraints": ["string"],
  "notes": "string | null",
  "created_at": "timestamp"
}
```

冻结原则：

- Phase 0 保留 `risk_plan` 独立对象
- 不把风险控制完全并回 `trade_plan`

## 7.6 `plan_review`

职责：

- 记录新 snapshot 到来后，对现有计划做出的维护动作

最小字段：

```json
{
  "id": "uuid",
  "trade_plan_id": "uuid",
  "snapshot_id": "uuid",
  "action": "keep | modify | reduce_risk | partial_take_profit | invalidate | close_plan",
  "reason": "string",
  "changed_fields": ["string"],
  "new_status": "string",
  "revision_trade_plan_id": "uuid | null",
  "created_at": "timestamp"
}
```

冻结原则：

- 每个 `trade_plan` 在每个 `snapshot_id` 上最多一条 review
- review 是动作记录，不替代 plan 本体

---

# 8. 状态机冻结

## 8.1 `trade_plan.status`

Phase 0 冻结以下状态：

- `drafted`
- `active_waiting_entry`
- `active_entered`
- `active_scaling_out`
- `closed_tp`
- `closed_sl`
- `closed_manual_rule`
- `invalidated`
- `expired`

## 8.2 `plan_review.action`

Phase 0 冻结以下动作：

- `keep`
- `modify`
- `reduce_risk`
- `partial_take_profit`
- `invalidate`
- `close_plan`

## 8.3 动作与状态的边界

冻结以下规则：

- `plan_review.action` 表示“这根 bar 上系统建议做什么”
- `trade_plan.status` 表示“计划当前处于什么生命周期阶段”
- `modify` 不等于状态变化
- `keep` 可以不改状态
- `invalidate` 必须把计划推进到 `invalidated`
- `close_plan` 必须把计划推进到某个 `closed_*` 终态

Phase 0 暂不冻结更细的状态转移表，只冻结动作集与状态集。

---

# 9. 多周期上下文边界

`multi_timeframe_market_context` 在 Phase 0 冻结为：

- 运行时派生对象
- 可用于 rule engine、analysis builder、plan generator
- 暂不作为核心持久化表强制落库

原因：

- 它依赖邻近周期最新 snapshot 拼装
- 先保证主链路跑通更重要
- 后续如确实需要缓存，可在 Phase 1/2 再引入物化表或 cache

Phase 0 先冻结周期映射规则：

- `5m -> 15m -> 1h`
- `15m -> 1h -> 4h`
- `1h -> 4h -> 1d`
- `4h -> 1d -> 1w`

说明：

- `1w` 在 MVP 中只作为高阶观察周期，不作为主计划周期

---

# 10. Supabase 表结构草案冻结

## 10.1 `raw_webhook_events`

建议字段：

- `id uuid primary key`
- `source text not null default 'tradingview'`
- `schema_version text not null`
- `dedupe_key text not null`
- `received_at timestamptz not null default now()`
- `raw_payload jsonb not null`
- `ingest_status text not null`
- `error_message text null`

建议索引：

- `unique (source, dedupe_key)`
- `index on received_at desc`
- `index on schema_version`

## 10.2 `bar_snapshots`

建议字段：

- `id uuid primary key`
- `raw_event_id uuid not null references raw_webhook_events(id)`
- `symbol text not null`
- `tickerid text not null`
- `exchange text not null`
- `timeframe text not null`
- `timeframe_label text not null`
- `bar_time timestamptz not null`
- `confirmed boolean not null`
- `open numeric not null`
- `high numeric not null`
- `low numeric not null`
- `close numeric not null`
- `volume numeric null`
- `event_type text not null`
- `event_direction text not null`
- `event_level integer null`
- `event_score numeric null`
- `regime_name text not null`
- `trend_score numeric null`
- `ema20 numeric null`
- `ema50 numeric null`
- `ema100 numeric null`
- `ema200 numeric null`
- `relative_high numeric null`
- `relative_low numeric null`
- `peak_nodes jsonb not null default '[]'::jsonb`
- `trough_nodes jsonb not null default '[]'::jsonb`
- `signal_bull_level integer null`
- `signal_bull_score numeric null`
- `signal_bull_new_fire boolean not null default false`
- `signal_bull_update_fire boolean not null default false`
- `signal_bear_level integer null`
- `signal_bear_score numeric null`
- `signal_bear_new_fire boolean not null default false`
- `signal_bear_update_fire boolean not null default false`
- `context_bull_active boolean not null default false`
- `context_bull_score numeric null`
- `context_bull_strong boolean not null default false`
- `context_bear_active boolean not null default false`
- `context_bear_score numeric null`
- `context_bear_strong boolean not null default false`
- `context_breakdown jsonb not null default '{}'::jsonb`
- `momentum jsonb not null default '{}'::jsonb`
- `osc jsonb not null default '{}'::jsonb`
- `divergence jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

建议索引：

- `unique (tickerid, timeframe, bar_time)`
- `index on (symbol, timeframe_label, bar_time desc)`
- `index on (event_type, bar_time desc)`
- `index on (regime_name, bar_time desc)`

## 10.3 `analysis_cards`

建议字段：

- `id uuid primary key`
- `snapshot_id uuid not null references bar_snapshots(id)`
- `status text not null`
- `summary_line text not null`
- `detailed_explanation text not null`
- `suggested_bias text not null`
- `confidence text not null`
- `risks jsonb not null default '[]'::jsonb`
- `model_name text not null`
- `raw_response jsonb null`
- `created_at timestamptz not null default now()`

建议索引：

- `unique (snapshot_id)`
- `index on created_at desc`

## 10.4 `trade_plans`

建议字段：

- `id uuid primary key`
- `snapshot_id uuid not null references bar_snapshots(id)`
- `symbol text not null`
- `anchor_timeframe text not null`
- `direction text not null`
- `status text not null`
- `thesis jsonb not null`
- `entry_plan jsonb not null`
- `take_profit_plan jsonb not null`
- `invalidation_plan jsonb not null`
- `management_rules jsonb not null default '[]'::jsonb`
- `expiry_rules jsonb not null default '[]'::jsonb`
- `confidence text not null`
- `previous_plan_id uuid null references trade_plans(id)`
- `created_at timestamptz not null default now()`
- `closed_at timestamptz null`

建议索引：

- `index on (symbol, anchor_timeframe, created_at desc)`
- `index on (status, created_at desc)`
- `index on (previous_plan_id)`

注意：

- Phase 0 先不加“同向只能一个活跃计划”的强约束索引
- 该约束放在业务规则层实现，后续再决定是否加 partial unique index

## 10.5 `risk_plans`

建议字段：

- `id uuid primary key`
- `trade_plan_id uuid not null references trade_plans(id)`
- `max_initial_risk_pct numeric not null`
- `size_guidance text not null`
- `invalid_if jsonb not null default '[]'::jsonb`
- `reduce_risk_if jsonb not null default '[]'::jsonb`
- `exposure_constraints jsonb not null default '[]'::jsonb`
- `notes text null`
- `created_at timestamptz not null default now()`

建议索引：

- `unique (trade_plan_id)`

## 10.6 `plan_reviews`

建议字段：

- `id uuid primary key`
- `trade_plan_id uuid not null references trade_plans(id)`
- `snapshot_id uuid not null references bar_snapshots(id)`
- `action text not null`
- `reason text not null`
- `changed_fields jsonb not null default '[]'::jsonb`
- `new_status text not null`
- `revision_trade_plan_id uuid null references trade_plans(id)`
- `created_at timestamptz not null default now()`

建议索引：

- `unique (trade_plan_id, snapshot_id)`
- `index on created_at desc`
- `index on (action, created_at desc)`

---

# 11. Rule Engine 冻结边界

Phase 0 不冻结完整规则表，但冻结规则入口与判断职责。

Rule Engine 必须回答 3 个问题：

1. 当前 snapshot 是否值得生成 `analysis_card`
2. 当前 snapshot 是否值得新建 `trade_plan`
3. 若已有活跃计划，当前 snapshot 是否值得生成 `plan_review`

Phase 0 明确采纳以下最低规则：

- `snapshot.close` 且无活跃计划，且主方向 `context.active = false` 时，不新建计划
- `signal.new` 或 `signal.upgrade` 且对应方向 `context.active = true` 时，允许建计划
- 有活跃计划时，每个 confirmed close 都允许进入 review 判断

Phase 0 暂不冻结：

- 轻量 review 与完整 review 的阈值
- token 节流策略
- 更细颗粒度的评分阈值

---

# 12. Phase 0 交付物

Phase 0 完成的判断标准冻结为：

- 页面清单定稿
- 核心对象定稿
- 表名与对象名定稿
- webhook 输入边界定稿
- normalized 输出边界定稿
- Supabase 表结构草案定稿

这意味着在进入 Phase 1 前，团队不应再讨论：

- `raw_event` 到底叫什么
- `normalized_event` 到底是什么
- `plan_review` 是否是独立对象
- `risk_plan` 是否单独存在
- timeline 页面是否属于 MVP

这些问题在本文之后视为已定案。
