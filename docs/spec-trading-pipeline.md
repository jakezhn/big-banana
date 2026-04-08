# 1. 先统一 MVP 的设计目标

我建议把 MVP 定义成 4 层：

## 第一层：市场状态采集层

负责接收 TradingView 的 webhook，并把每个 confirmed close 的 payload 入库。

## 第二层：市场理解层

把原始 payload 解析成标准化市场状态，形成：

* 当前主周期市场状态
* 上下级周期对当前主周期的支持/冲突
* 当前是否值得新建计划
* 当前已存在计划是否要修改

## 第三层：计划层

AI 基于当前市场状态生成：

* thesis
* entry plan
* TP plan
* SL / invalidation plan
* position management plan
* maintenance rules

## 第四层：计划维护层

后续每一根 confirmed close 都重新评估：

* 计划继续有效
* 计划要调 entry
* 计划要上调/下调止损
* 计划部分止盈
* 计划彻底失效
* 计划达到平仓条件

这比“只有信号来了才动”更符合你现在的 payload 设计，也更符合你想要的“先分析 context / structure，再持续维护计划”的目标。当前文件已经明确建议阅读顺序是：`summary.market → summary.event → summary.regime → summary.structure → detail.signal → detail.context → detail.momentum → detail.osc → detail.divergence`，这正好适合做成固定决策流水线。

---

# 2. 基于当前 payload 的核心认知模型

你给的 v9 payload 已经隐含了一套很强的因果层级：

## 顶层

* `summary.market`：这是哪一个市场、哪一个周期、哪根 confirmed bar
* `summary.event`：这根 bar 的主事件是什么
* `summary.regime`：大结构是什么
* `summary.structure`：价格正靠近哪些关键结构

## 底层修正

* `detail.signal`：多空两侧完整信号，不只是主事件那一侧
* `detail.context`：环境土壤是否成立，强不强，厚度来自哪里
* `detail.momentum`：动量方向与 squeeze 状态
* `detail.osc`：快慢线状态、方向切换、obos 拉伸
* `detail.divergence`：延续/衰竭修正线索

其中有几个点对 pipeline 很关键：

### 第一，`summary.event` 不是完整事件列表

它只保留当前 bar 的**主事件摘要**，而不是全部事件，因此系统不能只看它，必须同时看 `detail.signal`。

### 第二，`snapshot.close` 不是噪音

当前 event.type 的优先级是：

1. `signal.new`
2. `signal.upgrade`
3. `obos.change`
4. `snapshot.close`

这意味着：**没有更强事件时，系统仍然持续获得 bar-close 快照。** 对你要的“持续维护计划直到平仓”来说，`snapshot.close` 正是主循环心跳。

### 第三，`context.active / score / strong` 很适合做计划门槛

文件里已经把 context 拆成：

* `active`：有没有形成土壤
* `score`：土壤厚度
* `strong`：是否足够强
* 各种 units：厚度来源

这非常适合直接进入 LLM 前的**规则层预筛选**。

---

# 3. MVP 的总体架构

沿用你已有的轻量方向，我建议仍然是：

**TradingView Webhook → Supabase Edge Function → Postgres → LLM Analysis/Planning Service → Next.js Dashboard**

这和你已有轻量 MVP 思路一致，但我会把“计划生命周期状态机”补完整。现有方向已经把 MVP 定位为：事件采集 → 数据分析 → AI 生成分析/计划 → 页面展示；而我这里是在这个基础上，把“计划维护直到平仓”升级为正式一层。

---

# 4. 模块拆分

我建议拆成 10 个模块。

## M1. Webhook Ingestion

职责：

* 接收 TradingView webhook
* 验签
* 去重
* 快速 ACK
* 原始 payload 入库

输入：

* raw JSON payload

输出：

* `raw_webhook_event`

注意：
由于当前 payload 只会在 `alert_webhookEnabled = true` 且 `barstate.isconfirmed = true` 时发出，所以这里不需要处理未确认 bar。系统可以天然按 confirmed close 做状态机。

---

## M2. Payload Normalizer

职责：

* 从 raw payload 抽出统一字段
* 建立标准结构
* 形成后续 LLM 与前端都能直接消费的对象

输出对象：

* `normalized_bar_snapshot`

这个模块不做“最终交易判断”，只做结构化整理。

---

## M3. Multi-Timeframe Context Builder

职责：

* 针对当前 bar 所属周期，装配低一档/高一档周期状态
* 输出主周期交易决策所需的多周期上下文

建议映射：

### 当主交易周期 = 1h

* lower = 15m
* current = 1h
* higher = 4h

### 当主交易周期 = 4h

* lower = 1h
* current = 4h
* higher = 1d

### 当主交易周期 = 1d

* lower = 4h
* current = 1d
* higher = 1w（建议作为观察周期，不作为 MVP 主计划周期）

原因：
文件中 `timeframe_label` 已明确是给人和 LLM 读的，并且示例里已有 `15m / 1h / 4h / 1d` 这类标签；所以 1h 和 4h 的上下级可以自然建立。对于 1d，如果不引入 1w，你会缺“高一档”结构锚。

---

## M4. Rule Engine / Gatekeeper

职责：

* 在 LLM 前做硬规则筛选
* 决定是否值得：

  * 新建计划
  * 审核现有计划
  * 仅记录观察，不调用 LLM

这是 MVP 里很重要的一层，因为能省很多 token，也让系统更稳定。

### 典型规则

* `event.type = snapshot.close` 且计划为空，且 context 不 active，直接不建计划
* `signal.new / signal.upgrade` 且主方向 context.active=true，允许建计划
* 已有活跃计划时，每个 confirmed close 都触发 review，但：

  * 若结构变化极小，可走轻量 review
  * 若 regime/name、trend_score、context.active、signal.level 有实质变化，走完整 review

---

## M5. Market Analysis Builder

职责：

* 把规则层筛过的数据，转成 LLM 真正需要的输入上下文
* 输出一个非常干净的 `analysis_input`

这个模块特别重要，因为它决定 prompt 质量。

---

## M6. Plan Generator

职责：

* 在“当前没有活跃计划”或“当前事件足够强”时生成新计划

输出：

* `trading_plan`

内容必须包括：

* trade thesis
* entry strategy
* entry trigger
* TP stages
* SL / invalidation
* management rules
* expiry / stale conditions

---

## M7. Plan Reviewer

职责：

* 当已有活跃计划时，对每根 confirmed close 做评审

输出动作：

* `keep`
* `modify`
* `reduce_risk`
* `partial_take_profit`
* `invalidate`
* `close_plan`

这层是你新需求里的核心。

---

## M8. Plan State Machine

职责：

* 管理计划状态流转

建议状态：

* `drafted`
* `active_waiting_entry`
* `active_entered`
* `active_scaling_out`
* `closed_tp`
* `closed_sl`
* `closed_manual_rule`
* `invalidated`
* `expired`

---

## M9. Risk Engine

职责：

* 管理统一风控约束
* 即使 LLM 给出计划，也要经这层落地

例如：

* 最大初始风险 %
* 最大计划生命周期
* 同向重复计划限制
* 高周期冲突时降低仓位
* 结构失效后的强制退出条件

---

## M10. Execution Adapter（预留）

MVP 不下单，但预留：

* `simulate_order`
* `place_order`
* `amend_order`
* `cancel_order`
* `close_position`

这样后续接交易所不会推翻前面的设计。

---

# 5. 核心数据结构设计

下面给你一版足够完整、但仍适合 MVP 的对象设计。

## 5.1 raw_webhook_events

```json
{
  "id": "uuid",
  "received_at": "timestamp",
  "source": "tradingview",
  "schema_version": "bitpunk.webhook.v9",
  "dedupe_key": "string",
  "raw_payload": {}
}
```

---

## 5.2 normalized_bar_snapshot

```json
{
  "id": "uuid",
  "symbol": "BTCUSDT",
  "exchange": "BINANCE",
  "tickerid": "BINANCE:BTCUSDT",
  "timeframe": "240",
  "timeframe_label": "4h",
  "bar_time": "2026-04-08T08:00:00Z",
  "confirmed": true,

  "event": {
    "type": "signal.new",
    "direction": "bull",
    "level": 2,
    "score": 4.15
  },

  "regime": {
    "name": "Bull Expansion",
    "trend_score": 7.1
  },

  "structure": {
    "ema20": 64980.0,
    "ema50": 64620.0,
    "ema100": 64110.0,
    "ema200": 63280.0,
    "relative_high": 65540.0,
    "relative_low": 64320.0,
    "peak_nodes": [64890.0, 65180.0],
    "trough_nodes": [64540.0, 63980.0]
  },

  "signal": {
    "bull": { "level": 2, "score": 4.15, "new_fire": true, "update_fire": false },
    "bear": { "level": 0, "score": null, "new_fire": false, "update_fire": false }
  },

  "context": {
    "bull": {
      "active": true,
      "score": 4.45,
      "strong": true,
      "obos_units": 2.8,
      "sqz_units": 0.9,
      "regime_assist_units": 0.5,
      "htf_trend_assist_units": 0.45
    },
    "bear": {
      "active": false,
      "score": 0.9,
      "strong": false,
      "obos_units": 0.0,
      "sqz_units": 0.9,
      "regime_assist_units": 0.0,
      "htf_trend_assist_units": 0.0
    }
  },

  "momentum": {
    "value": 18.2,
    "sqz": "off",
    "is_bull": true,
    "bull_strong_to_weak": false,
    "bear_strong_to_weak": true
  },

  "osc": {
    "fast": 54.1,
    "slow": 48.6,
    "spread": 5.5,
    "bull_state": true,
    "bear_state": false,
    "bear_to_bull": true,
    "bull_to_bear": false,
    "obos_abs": 54.1,
    "obos_entered_or_upgraded": false
  },

  "divergence": {
    "regular_bull_triggered": false,
    "regular_bear_triggered": false,
    "hidden_bull_triggered": false,
    "hidden_bear_triggered": true
  }
}
```

这基本就是把当前文档的真实 payload 语义平移成内部标准对象。

---

## 5.3 multi_timeframe_market_context

```json
{
  "anchor_timeframe": "4h",
  "symbol": "BTCUSDT",

  "lower_tf": {
    "timeframe_label": "1h",
    "snapshot_id": "uuid",
    "direction_bias": "bull",
    "regime_name": "Bull Pullback",
    "trend_score": 5.2,
    "context_bull_active": true,
    "context_bear_active": false,
    "structure_bias": "support_nearby"
  },

  "current_tf": {
    "timeframe_label": "4h",
    "snapshot_id": "uuid",
    "direction_bias": "bull",
    "regime_name": "Bull Expansion",
    "trend_score": 7.1,
    "event_type": "signal.new",
    "event_level": 2
  },

  "higher_tf": {
    "timeframe_label": "1d",
    "snapshot_id": "uuid",
    "direction_bias": "bull",
    "regime_name": "Bull Transition",
    "trend_score": 4.6,
    "context_bull_active": true,
    "context_bear_active": false,
    "structure_bias": "resistance_overhead"
  },

  "alignment_summary": {
    "direction_alignment": "2_of_3_bull",
    "regime_alignment": "supportive",
    "structure_alignment": "mixed",
    "friction_level": "medium"
  }
}
```

---

## 5.4 trading_plan

这是最关键的对象。

```json
{
  "plan_id": "uuid",
  "status": "active_waiting_entry",
  "symbol": "BTCUSDT",
  "anchor_timeframe": "4h",
  "direction": "long",

  "plan_basis": {
    "created_from_snapshot_id": "uuid",
    "created_from_event_type": "signal.new",
    "created_from_event_level": 2,
    "thesis_version": 1
  },

  "market_thesis": {
    "summary": "4h bull expansion with supportive 1h context and still-constructive 1d backdrop.",
    "regime_read": "Primary regime remains bullish; pullbacks are more likely continuation than reversal unless key support breaks.",
    "structure_read": "Price is trading above ema20/ema50 cluster with nearby trough/ema support below and relative high overhead.",
    "context_read": "Bull context is active and strong; bearish context is not structurally dominant.",
    "invalid_if": [
      "4h closes below ema50 and loses nearby trough support",
      "1h and 4h both flip to active bear context",
      "current thesis loses structural continuation characteristics"
    ]
  },

  "entry_plan": {
    "mode": "limit_on_pullback",
    "entry_rationale": "Prefer entering on support revisit rather than chasing expansion.",
    "entry_variants": [
      {
        "variant_id": "A",
        "type": "market_now",
        "enabled": false,
        "condition": "Only if current bar is fresh signal.new and price remains near support cluster with no immediate overhead rejection."
      },
      {
        "variant_id": "B",
        "type": "limit_zone",
        "enabled": true,
        "zone": {
          "low": 64880.0,
          "high": 64980.0,
          "basis": ["ema20", "peak_or_trough_cluster"]
        },
        "condition": "Use when thesis is bullish but price is slightly extended."
      },
      {
        "variant_id": "C",
        "type": "lower_tf_confirmation",
        "enabled": true,
        "condition": "Wait for 1h or 15m bull re-activation near support before entering."
      }
    ],
    "entry_expiry_rule": "Cancel entry if 2 anchor bars pass without fill and structure deteriorates."
  },

  "take_profit_plan": {
    "style": "staged",
    "targets": [
      {
        "name": "TP1",
        "allocation_pct": 30,
        "type": "structure_front_run",
        "reference": "nearest_resistance_cluster",
        "offset_rule": "place slightly below resistance for long"
      },
      {
        "name": "TP2",
        "allocation_pct": 40,
        "type": "structure_front_run",
        "reference": "relative_high_or_next_peak_cluster",
        "offset_rule": "place slightly below resistance for long"
      },
      {
        "name": "TP3",
        "allocation_pct": 30,
        "type": "runner",
        "reference": "higher_tf_resistance_or_trend_extension",
        "offset_rule": "dynamic"
      }
    ]
  },

  "stop_loss_plan": {
    "style": "hybrid",
    "hard_stop": {
      "type": "structure_below_support",
      "reference": "ema50_or_trough_cluster",
      "offset_rule": "place slightly below support for long"
    },
    "soft_stop_rules": [
      "If lower timeframe fails first, reduce conviction but do not force exit immediately.",
      "If anchor timeframe closes through invalidation structure, close remaining position.",
      "If higher timeframe turns sharply adverse, tighten management and reduce re-entry aggressiveness."
    ],
    "staged_stop": {
      "enabled": false,
      "rules": []
    }
  },

  "risk_rules": {
    "max_risk_pct": 0.75,
    "max_plan_life_bars": 6,
    "no_add_if": [
      "higher timeframe opposes strongly",
      "anchor regime flips against thesis",
      "context.active disappears on both lower and anchor timeframes"
    ],
    "de_risk_if": [
      "bear divergence appears against long near overhead resistance",
      "momentum strong_to_weak appears while price stalls below target"
    ]
  },

  "maintenance_rules": {
    "review_every_confirmed_close": true,
    "review_priority": [
      "anchor structure breach",
      "anchor regime change",
      "context activation flip",
      "signal level upgrade/downgrade",
      "momentum weakening",
      "divergence against thesis"
    ],
    "allowed_actions": [
      "keep",
      "tighten_stop",
      "widen_entry_zone_before_fill",
      "cancel_unfilled_entry",
      "partial_take_profit",
      "full_exit",
      "invalidate"
    ]
  }
}
```

---

## 5.5 plan_review

```json
{
  "review_id": "uuid",
  "plan_id": "uuid",
  "trigger_snapshot_id": "uuid",
  "review_type": "bar_close_maintenance",
  "decision": "modify",
  "decision_reason": "Bull thesis remains intact, but lower timeframe weakened and price is approaching first overhead structure.",
  "changes": [
    {
      "path": "stop_loss_plan.soft_stop_rules",
      "action": "append",
      "value": "Tighten risk if next anchor close loses ema20 support."
    },
    {
      "path": "take_profit_plan.targets[0]",
      "action": "mark_ready",
      "value": true
    }
  ],
  "thesis_still_valid": true,
  "recommended_user_action": "keep plan active and tighten monitoring"
}
```

---

# 6. 事件分类与处理逻辑

当前文件里 `summary.event.type` 有四种。对 pipeline 来说，最好这样处理：

## A. `signal.new`

作用：

* 优先考虑创建新计划
* 若已有反向计划，优先 review 或失效它
* 若已有同向计划，则可能：

  * keep
  * 加强 thesis
  * 调整 entry
  * 调整 TP/SL

这是最强的计划触发器。

## B. `signal.upgrade`

作用：

* 不一定创建新计划
* 更常见是：

  * 提升同向计划置信度
  * 放宽 entry 触发条件
  * 允许更激进 TP3 runner
  * 调整止损到更结构化的位置

## C. `obos.change`

作用：

* 更像 context 内部状态变化
* 单独不足以创建重计划
* 但很适合：

  * 维护现有计划
  * 调整节奏
  * 提醒“扩张后可能钝化 / 反身性增强”

## D. `snapshot.close`

作用：

* 主循环心跳
* 即使没有显著事件，也必须 review 现有计划
* 对无持仓/无计划状态，可仅做轻量记录

这正是你要的“无信号也持续追踪”。

---

# 7. 多周期决策框架

我建议把**主计划**只锚定在 1h / 4h / 1d，但“辅助周期”允许延伸。

## 7.1 主周期职责

### 1h 计划

适合：

* 更战术
* 更短持有
* 更依赖 15m 触发与 4h 背景过滤

### 4h 计划

适合：

* MVP 的主力周期
* 结构与信号都比较均衡
* 1h 做节奏，1d 做方向过滤

### 1d 计划

适合：

* 更慢、更保守
* 4h 做入场优化
* 1w 做背景约束

---

## 7.2 多周期使用规则

### 当锚定 1h

* 方向主要看 1h
* 是否允许重仓看 4h
* 具体入场节奏看 15m

### 当锚定 4h

* 方向主要看 4h
* 1h 决定要不要等 pullback confirmation
* 1d 决定顺势还是逆势

### 当锚定 1d

* 方向主要看 1d
* 4h 决定是否已有更好位置
* 1w 决定是否接近大级别逆风区

---

## 7.3 多周期冲突时怎么做

这是 MVP 里必须显式写清楚的。

### 同向三周期一致

* 可允许更直接的 entry
* 可允许更长 TP3 runner
* 初始止损可相对宽一点但仍基于结构

### 主周期与高周期一致，低周期逆

* 不取消计划
* 更偏向等待 lower_tf confirmation 再入场

### 主周期成立，但高周期强逆风

* 计划可存在
* 但降风险、缩 TP、提高失效敏感度

### 主周期已破坏

* 即使低周期还在挣扎，也不保留原计划
* 原计划要 review / invalidate

---

# 8. 计划生成逻辑

你的重点是：**先分析 context 和 structure，再给 entry / TP / SL。**
我完全同意，所以我建议 Plan Generator 必须按这个固定顺序工作：

## 第一步：判断是否允许立 thesis

先问：

* 当前 regime 是否支持方向性 thesis
* 当前 structure 是否有可定义的支撑/阻力锚
* 当前 context 是否 active
* 当前 signal 是否只是噪音级别

如果这些不成立，就不给交易计划，只给“观察结论”。

---

## 第二步：建立 thesis

thesis 应该至少回答：

* 当前主方向是什么
* 这是 continuation、pullback、transition、还是逆势反弹
* 主要优势来自哪里
* 主要风险来自哪里
* 什么情况下 thesis 失效

---

## 第三步：选择 entry mode

只允许三类：

### 1. `market_now`

适合：

* 新鲜强信号
* 结构位置不差
* 上级周期不逆风

### 2. `limit_on_key_level`

适合：

* thesis 对，但价格略延伸
* 等回踩 ema / trough / VP 节点
* 这是最符合你体系的一类

### 3. `wait_lower_tf_confirmation`

适合：

* 主周期看多/看空
* 但希望更精细节奏
* 比如 4h thesis + 1h/15m 确认再进

---

# 9. 止盈与止损设计

你之前就明确偏好**结构式 TP 123**，这里我把它正式纳入 pipeline。

## 9.1 止盈

建议 MVP 默认模板：

* `TP1 = 30%`
* `TP2 = 40%`
* `TP3 = 30%`

而且不是死板价格点，而是：

### Long

* TP 放在关键阻力 **下方一点**

### Short

* TP 放在关键支撑 **上方一点**

这样和你之前的偏好一致，也符合你说的“避免死板用结构值本身”。

---

## 9.2 止损

MVP 支持两种：

### A. 非分阶段止损

更适合 MVP 默认：

* 一个明确的结构失效位
* 一旦 anchor timeframe confirmed close 失效，则出场

### B. 分阶段止损

预留支持，但不作为默认：

* lower_tf 先失效：降信念/减仓/不加仓
* anchor_tf 失效：平仓
* higher_tf 反转：收紧策略，不一定立刻平仓

我建议 MVP 先采用：
**“硬结构止损 + 软规则维护”**
最稳。

---

# 10. 计划维护逻辑

这是你这次要求里最重要的一段。

## 原则

**计划不是一次性文本，而是持续更新的状态对象。**

所以每根 confirmed bar close 都执行：

### Step 1. 获取当前活跃计划

若没有计划：

* 看是否要新建

若有计划：

* 进入 review

### Step 2. 重算当前市场状态

重新构建：

* current tf context
* lower tf context
* higher tf context
* structure distance
* regime drift
* signal drift

### Step 3. 计算计划偏离

主要看：

* thesis 是否仍成立
* entry 前提是否还成立
* price 是否已经错过最佳 entry
* TP1 是否应触发
* 结构止损是否更近
* 是否出现反向 divergence / momentum weakening

### Step 4. 输出动作

只允许有限动作集：

* keep
* modify_entry
* tighten_stop
* reduce_risk
* partial_take_profit
* invalidate_unfilled
* full_exit

---

# 11. 什么时候新建计划，什么时候只做观察

我建议 LLM 之前先有硬规则：

## 新建计划的最低门槛

至少满足其中大部分：

* `summary.event.type` 是 `signal.new` 或 `signal.upgrade`
* 同方向 `detail.context.active = true`
* 主周期 structure 可定义
* 不存在明显更高周期反向压制
* 风险回报仍可成立

## 只做观察不建计划

比如：

* `snapshot.close`
* 无活跃计划
* context 不 active
* signal level 低
* structure 模糊
* 上下周期严重冲突

这样能避免系统过度产出垃圾计划。

---

# 12. 数据库表设计

MVP 我建议最少这些表：

* `raw_webhook_events`
* `bar_snapshots`
* `multi_tf_contexts`
* `plan_candidates`
* `trading_plans`
* `plan_reviews`
* `positions_simulated`
* `risk_events`
* `llm_runs`
* `system_prompt_versions`

其中 `system_prompt_versions` 很重要，因为你后面一定会不断迭代 planner / reviewer prompt。

---

# 13. LLM 输入输出设计

## 13.1 Analysis Input

这是给 LLM 的清洁输入，不直接塞 raw payload。

```json
{
  "task": "generate_or_review_trade_plan",
  "symbol": "BTCUSDT",
  "anchor_timeframe": "4h",
  "timestamp": "2026-04-08T08:00:00Z",

  "current_snapshot": {},
  "lower_tf_snapshot": {},
  "higher_tf_snapshot": {},

  "existing_plan": {},
  "position_state": {},
  "risk_policy": {},

  "instructions": {
    "prefer_structure_based_entry": true,
    "prefer_structure_based_take_profit": true,
    "prefer_structure_based_stop_loss": true,
    "do_not_chase_if_extended": true,
    "must_define_invalidation": true
  }
}
```

---

## 13.2 Plan Output Schema

必须是结构化 JSON，不要自由散文。

```json
{
  "decision": "create_plan",
  "plan_direction": "long",
  "confidence": 0.72,
  "thesis_summary": "string",
  "market_state_assessment": {
    "anchor_tf_bias": "bullish",
    "lower_tf_role": "timing_support",
    "higher_tf_role": "macro_filter",
    "alignment": "supportive"
  },
  "entry_plan": {},
  "take_profit_plan": {},
  "stop_loss_plan": {},
  "risk_rules": {},
  "maintenance_rules": {},
  "why_not_now": [],
  "invalid_if": [],
  "notes_for_next_review": []
}
```

---

# 14. System Prompt 设计

下面给你一版适合 MVP 的核心 prompt 思路。

## 14.1 Planner System Prompt

```text
You are the trading planner for the Bitpunk MVP pipeline.

Your job is not to predict blindly.
Your job is to read structured market-state snapshots and produce disciplined, structure-based trade plans.

You must follow this order:
1. Read market and timeframe context.
2. Read anchor timeframe regime and structure.
3. Read lower and higher timeframe alignment.
4. Read detailed signal, context, momentum, osc, and divergence.
5. Decide whether a valid trade thesis exists.
6. If no valid thesis exists, do not force a trade plan.
7. If a thesis exists, generate a plan with:
   - thesis summary
   - entry strategy
   - entry conditions
   - staged take-profit plan
   - stop-loss / invalidation plan
   - maintenance rules
   - plan expiry rules

Rules:
- Prefer structure-based entries over emotional chasing.
- Prefer placing long take-profits slightly below resistance.
- Prefer placing short take-profits slightly above support.
- Prefer placing long stops slightly below invalidation support.
- Prefer placing short stops slightly above invalidation resistance.
- Use lower timeframe mainly for timing and confirmation.
- Use higher timeframe mainly as directional filter and structural ceiling/floor.
- Distinguish between continuation, pullback continuation, transition, and weak countertrend setups.
- Do not overreact to a single field.
- `summary` gives the outline; `detail` refines and corrects the outline.
- A plan must include explicit invalidation.
- If structure is unclear, return observe_only rather than forcing a trade.
```

这里特意把“summary 先轮廓，detail 再修正”固化进 prompt，因为文件已经明确这样定义。

---

## 14.2 Reviewer System Prompt

```text
You are the trade-plan reviewer for the Bitpunk MVP pipeline.

You review an existing plan on every confirmed bar close.

Your job is to decide whether the existing plan should:
- keep
- modify
- tighten risk
- partial take profit
- invalidate
- close

Review order:
1. Check whether the original thesis is still structurally valid.
2. Check whether anchor timeframe regime has improved, weakened, or flipped.
3. Check whether lower timeframe timing has improved or deteriorated.
4. Check whether higher timeframe support/conflict has changed.
5. Check whether price has reached a meaningful structure relative to TP/SL.
6. Check whether divergence or momentum weakening changes risk.
7. Output the minimal necessary action.

Rules:
- Do not rewrite the whole plan if only a small adjustment is needed.
- Anchor timeframe structure breach matters more than lower timeframe noise.
- If the entry has not filled and the setup becomes stale, cancel rather than force.
- If thesis remains intact but momentum weakens near target, partial TP is allowed.
- If the thesis is broken on anchor timeframe confirmed close, invalidate or close.
- Always explain what changed since the prior review.
```

---

# 15. 非 LLM 的硬规则建议

为了让系统更稳，我建议以下内容不要交给 LLM 决定，而由程序控制：

## 必须程序控制

* 去重
* schema 校验
* event 入库
* 周期匹配
* 计划状态流转
* 最大生命周期 bars
* 最大风险 %
* 是否允许同向重叠计划
* review 频率
* 结构价位前后 buffer 的最小规则

## 可以交给 LLM

* thesis 文本表达
* entry mode 选择
* TP1/2/3 的结构映射优先级
* 软止损/维护逻辑
* 计划修正原因

---

# 16. 前端页面建议

MVP 至少要有：

## `/events`

看所有 confirmed close snapshots

## `/events/[id]`

看单根 bar 的完整：

* summary
* detail
* raw payload
* AI analysis

## `/plans`

看所有计划

## `/plans/[id]`

看单计划生命周期：

* 创建时 thesis
* 每次 review
* entry changes
* TP / SL changes
* 最终关闭原因

## `/timeline`

把 event → analysis → plan → review 串起来

这和你之前轻量 MVP 的页面方向一致，但这里会更强调 plan lifecycle。

---

# 17. MVP 的实际运行节奏

我建议每个 confirmed close 的流水线如下：

## A. 新 payload 到达

1. 验签
2. raw 入库
3. normalize
4. 关联 symbol + timeframe

## B. 构建多周期上下文

1. 找当前 tf 最新快照
2. 找 lower tf 最近闭合快照
3. 找 higher tf 最近闭合快照
4. 形成 multi-tf context

## C. 查现有活跃计划

* 无 → 看是否创建
* 有 → 进入 review

## D. Rule Engine 决定是否调用 LLM

* 纯记录
* 轻量 review
* 完整 review
* 新建计划

## E. LLM 输出结构化结果

* analysis
* new plan 或 review action

## F. 状态机落库

* 更新 plan
* 更新 plan status
* 记录 risk event
* 记录 timeline item

---

# 18. 我认为还必须补充的几个重要点

## 18.1 Plan Expiry

你特别需要这个。
因为不是每个 thesis 都会在合理时间内兑现。

建议：

* 1h 计划：2~4 根 anchor bars 还没进场且结构变钝，取消
* 4h 计划：3~6 根 anchor bars
* 1d 计划：2~4 根 anchor bars

## 18.2 Thesis Drift

不是只有“成立 / 不成立”。
很多时候是：

* thesis 仍成立
* 但最佳 entry 已过去
* 或风险收益比已变差

所以要有：

* `still_valid_but_not_attractive`
  这个状态。

## 18.3 One Plan Per Direction Per Anchor TF

MVP 阶段我建议限制：

* 同一 symbol
* 同一 anchor timeframe
* 同一方向
  只保留一个活跃计划

避免计划爆炸。

## 18.4 Explainability

每次 plan review 一定要记录：

* compared_to_previous
* what changed
* why action changed

这样后面你才能真正 debug LLM。

---

# 19. 最后一版建议：MVP 的真正核心状态机

我建议你把 MVP 的主引擎定义成下面这个伪代码：

```text
on_confirmed_bar_close(payload):
    raw_event = ingest(payload)
    snapshot = normalize(raw_event)
    multi_tf_context = build_multi_tf_context(snapshot)

    active_plan = find_active_plan(symbol=snapshot.symbol, anchor_tf=snapshot.timeframe_label)

    if not active_plan:
        if should_create_plan(snapshot, multi_tf_context):
            analysis = run_event_analysis(snapshot, multi_tf_context)
            plan = run_plan_generator(snapshot, multi_tf_context, analysis)
            persist(plan)
        else:
            persist_observation(snapshot)
    else:
        review_mode = select_review_mode(snapshot, multi_tf_context, active_plan)
        review = run_plan_reviewer(snapshot, multi_tf_context, active_plan, review_mode)
        apply_review_to_plan(active_plan, review)
        persist(review)
```

---

# 20. 结论

基于你给的文件，我认为最合理的 MVP 不是“事件来了就生成一段 AI 文本”，而是：

**以 confirmed bar close 为驱动、以 summary→detail 为分析顺序、以 context/structure 为交易前提、以交易计划状态机为中心的持续维护系统。**

最关键的三点是：

第一，当前 v9 payload 已经天然适合这个方向，因为它明确区分了 `summary` 和 `detail`，并且事件类型本身就支持 `snapshot.close` 这种持续状态更新。

第二，你之前的轻量 MVP 架构是对的，但要从“分析页 + 计划页”升级成“**计划生成 + 计划维护 + 生命周期时间线**”，这样才真正能承载你要的交易 workflow。

第三，MVP 最应该优先做的不是 execution，而是：
**标准化数据结构、固定 LLM 输入输出、明确计划状态机、以及每根 confirmed close 的 review 机制。**

如果你要，我下一步可以直接把这版继续落到更工程化的层面，给你一份：
**Postgres 表结构 + TypeScript 类型定义 + Edge Function 清单 + Planner/Reviewer JSON Schema**。
