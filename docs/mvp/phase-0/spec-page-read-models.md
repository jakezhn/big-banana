# Page Read Models

这份文档定义 Phase 0 页面读取层的 query/read-model 方案。

目标是：

1. 不让前端自己拼复杂 join
2. 把 `/events` 和 `/plans/[id]` 的读模型定死
3. 把数据库 view、服务端查询和页面响应 shape 对齐

如果本文与以下文档冲突，以本文为准：

- [`phase-0-freeze.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/phase-0-freeze.md)
- [`spec-supabase-postgres-schema.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/spec-supabase-postgres-schema.md)
- [`supabase/migrations/0003_phase0_views_and_realtime.sql`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/supabase/migrations/0003_phase0_views_and_realtime.sql)

---

# 1. 设计原则

Phase 0 的页面读取层采用：

- 数据库 view 提供基础读模型
- Next.js server layer 负责补少量二次查询和聚合
- browser client 不直接写业务表
- browser client 尽量不自己拼跨表 join

读模型分层：

1. database view
2. server-side query adapter
3. page props / API response

说明：

- Phase 0 不强制引入 BFF service
- 直接用 Next.js server component / server action 即可

---

# 2. `/events` 读模型

## 2.1 页面目标

`/events` 页只负责：

- 展示事件流
- 做基础过滤
- 展示事件相关联的分析与计划状态

它不负责：

- 展示完整 raw JSON
- 展示完整 plan timeline

## 2.2 数据来源

`/events` 的基础数据源固定为：

- `public.v_event_feed`

该 view 已在：

- [`0003_phase0_views_and_realtime.sql`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/supabase/migrations/0003_phase0_views_and_realtime.sql#L1)

定义。

## 2.3 允许的 query 参数

`/events` 允许以下 query 参数：

- `symbol`
- `timeframe_label`
- `event_direction`
- `regime_name`
- `limit`
- `cursor_bar_time`
- `cursor_snapshot_id`

约束：

- `limit` 默认 `50`
- `limit` 最大 `100`
- 默认按 `bar_time desc, snapshot_id desc` 排序
- cursor-based pagination，不做 page number

## 2.4 过滤规则

过滤字段固定为：

- `symbol = exact match`
- `timeframe_label = exact match`
- `event_direction = exact match`
- `regime_name = exact match`

Phase 0 不做：

- 模糊搜索
- 全文搜索
- 多字段复合排序切换

## 2.5 返回字段

`/events` 页服务端返回对象建议如下：

```json
{
  "items": [
    {
      "snapshot_id": "uuid",
      "symbol": "BTCUSDT",
      "tickerid": "BINANCE:BTCUSDT",
      "exchange": "BINANCE",
      "timeframe": "240",
      "timeframe_label": "4h",
      "bar_time": "2026-04-08T08:00:00Z",
      "event_type": "signal.new",
      "event_direction": "bull",
      "event_level": 2,
      "event_score": 4.15,
      "regime_name": "Bull Expansion",
      "trend_score": 7.1,
      "analysis_card_id": "uuid | null",
      "trade_plan_id": "uuid | null",
      "latest_plan_review_id": "uuid | null"
    }
  ],
  "next_cursor": {
    "cursor_bar_time": "2026-04-08T04:00:00Z",
    "cursor_snapshot_id": "uuid"
  }
}
```

## 2.6 推荐 SQL 形态

服务端查询建议：

```sql
select *
from public.v_event_feed
where
  (:symbol is null or symbol = :symbol)
  and (:timeframe_label is null or timeframe_label = :timeframe_label)
  and (:event_direction is null or event_direction = :event_direction)
  and (:regime_name is null or regime_name = :regime_name)
  and (
    :cursor_bar_time is null
    or (bar_time, snapshot_id) < (:cursor_bar_time, :cursor_snapshot_id)
  )
order by bar_time desc, snapshot_id desc
limit :limit;
```

说明：

- `cursor_bar_time + cursor_snapshot_id` 保证排序稳定
- 前端不需要自己理解 lateral join

## 2.7 Realtime 刷新策略

`/events` 页只监听：

- `bar_snapshots`
- `analysis_cards`
- `trade_plans`
- `plan_reviews`

前端收到 realtime update 后：

- 优先轻量 refresh 当前列表
- 不在 client 侧自己拼 patch 逻辑

---

# 3. `/plans/[id]` 读模型

## 3.1 页面目标

`/plans/[id]` 页负责：

- 展示计划主信息
- 展示风险信息
- 展示 review 时间线
- 展示与计划相关的 snapshot 时间线

## 3.2 主数据来源

主查询固定为：

- `public.v_plan_timeline`

该 view 已在：

- [`0003_phase0_views_and_realtime.sql`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/supabase/migrations/0003_phase0_views_and_realtime.sql#L38)

定义。

主查询目标：

- 通过一个查询拿到 plan header、risk plan、review timeline 聚合结果

## 3.3 辅助查询

`v_plan_timeline` 不负责展开所有关联 snapshot 明细。

因此 `/plans/[id]` 允许一个辅助查询：

- `plan_related_snapshots`

推荐查询来源：

- `trade_plans`
- `plan_reviews`
- `bar_snapshots`

推荐逻辑：

1. 先取 origin snapshot
2. 再取所有 review 关联 snapshot
3. 按 `bar_time asc` 排序

## 3.4 主响应对象

服务端最终返回建议如下：

```json
{
  "plan": {
    "trade_plan_id": "uuid",
    "origin_snapshot_id": "uuid",
    "origin_bar_time": "2026-04-08T08:00:00Z",
    "symbol": "BTCUSDT",
    "anchor_timeframe": "4h",
    "direction": "long",
    "status": "active_waiting_entry",
    "thesis": {},
    "entry_plan": {},
    "take_profit_plan": {},
    "invalidation_plan": {},
    "management_rules": [],
    "expiry_rules": [],
    "confidence": "medium",
    "previous_plan_id": null,
    "created_at": "2026-04-08T08:00:02Z",
    "closed_at": null
  },
  "risk_plan": {
    "risk_plan_id": "uuid | null",
    "max_initial_risk_pct": 0.5,
    "size_guidance": "small starter",
    "risk_invalid_if": [],
    "reduce_risk_if": [],
    "exposure_constraints": [],
    "risk_notes": null
  },
  "review_timeline": [
    {
      "id": "uuid",
      "snapshot_id": "uuid",
      "action": "modify",
      "reason": "string",
      "changed_fields": ["entry_plan"],
      "new_status": "active_waiting_entry",
      "revision_trade_plan_id": "uuid | null",
      "created_at": "timestamp"
    }
  ],
  "related_snapshots": [
    {
      "snapshot_id": "uuid",
      "bar_time": "timestamp",
      "event_type": "signal.new",
      "event_direction": "bull",
      "event_level": 2,
      "event_score": 4.15,
      "regime_name": "Bull Expansion",
      "trade_plan_id": "uuid | null",
      "plan_review_id": "uuid | null"
    }
  ]
}
```

## 3.5 主查询 SQL

```sql
select *
from public.v_plan_timeline
where trade_plan_id = :trade_plan_id
limit 1;
```

## 3.6 辅助查询 SQL

```sql
with plan_origin as (
  select
    tp.id as trade_plan_id,
    tp.snapshot_id
  from public.trade_plans tp
  where tp.id = :trade_plan_id
),
review_snapshots as (
  select
    pr.id as plan_review_id,
    pr.trade_plan_id,
    pr.snapshot_id
  from public.plan_reviews pr
  where pr.trade_plan_id = :trade_plan_id
)
select
  bs.id as snapshot_id,
  bs.bar_time,
  bs.event_type,
  bs.event_direction,
  bs.event_level,
  bs.event_score,
  bs.regime_name,
  po.trade_plan_id,
  rs.plan_review_id
from public.bar_snapshots bs
left join plan_origin po
  on po.snapshot_id = bs.id
left join review_snapshots rs
  on rs.snapshot_id = bs.id
where
  bs.id in (
    select snapshot_id from plan_origin
    union
    select snapshot_id from review_snapshots
  )
order by bs.bar_time asc, bs.id asc;
```

## 3.7 页面渲染规则

`/plans/[id]` 页按以下分区渲染：

1. plan header
2. thesis / entry / TP / invalidation
3. risk block
4. review timeline
5. related snapshot timeline

说明：

- 页面层不需要知道底层 join 细节
- 页面层只消费服务端 adapter 返回的统一对象

---

# 4. 服务端 adapter 约定

## 4.1 `/events`

推荐封装：

- `getEventFeed(params)`

职责：

- 参数校验
- 读取 `v_event_feed`
- 输出页面可直接消费的列表结果

## 4.2 `/plans/[id]`

推荐封装：

- `getPlanTimeline(tradePlanId)`

职责：

- 主查询读取 `v_plan_timeline`
- 辅助查询读取 related snapshots
- 合并成单一页面响应对象

## 4.3 错误处理

Phase 0 约定：

- `/events` 查询失败 -> 返回空态或 500 页面
- `/plans/[id]` 未命中 -> 返回 404
- `/plans/[id]` 查到 plan 但 risk/review 为空 -> 仍返回 200

---

# 5. Phase 0 不做的页面读模型

Phase 0 暂不单独定义：

- `/` Dashboard 的聚合读模型
- `/events/[id]` 的详情读模型
- `/plans` 列表页

原因：

- 当前最容易把前端复杂度抬高的，是 `/events` 和 `/plans/[id]`
- 先把这两页固定下来，已经能避免大部分 join 漂移

---

# 6. Phase 0 定案

进入开发前，以下内容视为已冻结：

- `/events` 直接读 `v_event_feed`
- `/plans/[id]` 主查 `v_plan_timeline`
- `/plans/[id]` 允许一个 related snapshots 辅助查询
- 前端页面不直接拼复杂跨表 join
- cursor 分页固定使用 `bar_time + snapshot_id`
