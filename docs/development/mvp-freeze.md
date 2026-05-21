# MVP Freeze

## 1. 文档地位

这份文档是 MVP 实施阶段的唯一冻结规格。

优先级如下：

1. `webhook-payload-spec.md`：外部 payload 已冻结，不再改语义。
2. `mvp-freeze.md`：当前实现契约。
3. `mvp-architecture.md`：系统设计、部署与工程边界。
4. `mvp-validation-and-dashboard.md`：MVP 验证目标与 dashboard 路线。

## 2. 冻结决策

| 主题 | MVP 决策 |
|---|---|
| 架构 | 模块化单体，不拆微服务 |
| LLM 入口 | Vercel AI Gateway |
| 模型策略 | 只保留 `plan.generate` 与 `plan.update` |
| Payload | 使用冻结的 `bitpunk.webhook.v12` |
| 首发交易所 | Bybit `linear` |
| 执行方式 | HTTP submit + REST reconcile |
| private WS | Phase 2，再接入 |
| 执行主模式 | MVP 默认 `full`，自动 paper execution |
| 计划对象 | `action + market_thesis + execution_playbook + risk_intent` |
| Dashboard 摘要 | 先由结构化计划直接渲染，不额外调用模型 |

## 3. 冻结契约

机器可读 schema 位于：

- `docs/development/schemas/webhook-payload-v12.schema.json`
- `docs/development/schemas/trade-plan.schema.json`
- `docs/development/schemas/risk-verdict.schema.json`
- `docs/development/schemas/execution-intent.schema.json`

### 3.1 Canonical Envelope

```ts
type CanonicalEnvelope = {
  source: "tradingview";
  sourceSchemaVersion: "bitpunk.webhook.v12";
  internalSchemaVersion: "core.alert.v1";
  type: "snapshot" | "signal";
  marketKey: string;
  eventKey: string;
  barTimeMs: number;
  receivedAt: string;
  context: unknown;
  signal?: unknown;
  raw: unknown;
};
```

规则：

- `marketKey = tickerid + ":" + timeframe`
- `eventKey = tickerid + ":" + timeframe + ":" + bar.time_ms + ":" + type`
- 未知 `schema_version` 直接隔离，不进入后续 workflow。

### 3.2 Trade Plan

```ts
type TradePlan = {
  action: "create" | "keep" | "patch" | "terminate" | "skip";
  market_thesis: {
    bias: "long" | "short" | "neutral";
    environment: "trend" | "range" | "transition" | "exhaustion";
    htf_bias: "bull" | "bear" | "neutral";
    mtf_bias: "bull" | "bear" | "neutral";
    bias_confidence: number;
    trend_end_score: number;
    structure_summary: string;
    key_levels: Array<{
      role: "support" | "resistance";
      price_ref: "EMA50" | "EMA100" | "EMA200" | "relative_high" | "relative_low";
      importance: "primary" | "secondary";
    }>;
  };
  execution_playbook: {
    state:
      | "watch"
      | "armed"
      | "pending_entry"
      | "entered"
      | "managing"
      | "exit_only"
      | "closed"
      | "invalidated"
      | "expired";
    entry_style: "pullback" | "breakout_retest" | "range_edge" | "probe";
    entry_zone: {
      low: number | null;
      high: number | null;
      source: "structure" | "atr_band" | "exec_tf_setup";
    };
    allowed_triggers: Array<
      "aligned_signal" | "zone_touch" | "break_retest" | "counter_signal_for_trim"
    >;
    requires_signal: boolean;
    disqualifiers: string[];
    tp_style: "ladder" | "dynamic_trail" | "range_mean_revert";
    update_policy: "minor_patch" | "major_patch" | "replace_only";
  };
  risk_intent: {
    risk_tier: "probe" | "starter" | "standard" | "high_conviction";
    suggested_max_account_risk_pct: number;
    stop_anchor: "swing_low" | "swing_high" | "key_level_break" | "range_edge_break";
    stop_buffer_atr: number;
    rationale_codes: string[];
  };
  reasoning_summary: string;
  evidence: string[];
};
```

约束：

- `action=skip` 时，`execution_playbook.state` 必须为 `watch`。
- `market_thesis.bias=neutral` 时，不得生成执行意图。
- `action=create` 时，必须有非空的 `market_thesis`、`execution_playbook`、`risk_intent`。
- 数量、杠杆、最终止损价不由 agent 决定。

### 3.3 Risk Verdict

```ts
type RiskVerdict = {
  verdict: "approve" | "approve_with_reduction" | "reject";
  approved_risk_pct: number;
  approved_qty: number | null;
  approved_notional: number | null;
  approved_stop_price: number | null;
  require_human_approval: boolean;
  checks: Array<{
    code: string;
    status: "pass" | "fail" | "warn";
    detail: string;
  }>;
  rejection_codes: string[];
};
```

必做检查：

| Code | 规则 |
|---|---|
| `REQUIRE_STOP` | 无止损意图不得开仓 |
| `MAX_TRADE_RISK` | 单笔风险不得超上限 |
| `MAX_DAILY_LOSS` | 当日亏损超限后禁止新开仓 |
| `MAX_CONSECUTIVE_LOSSES` | 连续亏损超限后禁止新开仓 |
| `MAX_LEVERAGE` | 杠杆不得超限 |
| `MAX_NOTIONAL` | 名义仓位不得超限 |
| `REDUCE_ONLY_EXIT` | 退出类动作必须 `reduce_only` |
| `KILL_SWITCH` | kill switch 打开时只允许减仓和平仓 |
| `ENTRY_ZONE_READY` | 没有可执行入场区，不得生成开仓 intent |

### 3.4 Execution Intent

```ts
type ExecutionIntent = {
  action: "open" | "amend" | "cancel" | "reduce" | "close";
  plan_version_id: string;
  trading_account_id: string;
  symbol: string;
  side: "buy" | "sell";
  order_type: "limit" | "market" | "conditional";
  time_in_force: "GTC" | "IOC" | "FOK" | "PostOnly";
  qty: number;
  price: number | null;
  stop_price: number | null;
  reduce_only: boolean;
  client_order_id: string;
  idempotency_key: string;
};
```

规则：

- `open` 必须来自 `approve` 或 `approve_with_reduction`。
- `client_order_id` 必须在 venue 内唯一。
- `reduce` / `close` 必须 `reduce_only=true`。
- `price`、`qty`、`stop_price` 在提交前都必须通过 venue preflight。

## 4. 状态机

### 4.1 Plan State

| From | To | Guard |
|---|---|---|
| `watch` | `armed` | thesis 成立，entry zone 已定义 |
| `armed` | `pending_entry` | trigger 成立，risk verdict 已通过 |
| `pending_entry` | `entered` | 首单成交 |
| `entered` | `managing` | 止损与退出规则已生效 |
| `managing` | `exit_only` | thesis 退化但尚未失效 |
| `managing` | `invalidated` | thesis 失效或硬止损触发 |
| `exit_only` | `closed` | 仓位归零 |
| `invalidated` | `closed` | 仓位归零 |
| `watch` / `armed` / `pending_entry` | `expired` | TTL 到期 |

规则：

- `skip` 不创建 active plan。
- `patch` 只能修改同一 plan 的新版本，不得偷偷新建另一条并行 thesis。
- `terminate` 必须写入 `plan_transitions`，并触发所有未成交执行意图取消。

### 4.2 Order State

| From | To | Guard |
|---|---|---|
| `drafted` | `preflight_failed` | venue preflight 未通过 |
| `drafted` | `approved` | venue preflight 通过 |
| `approved` | `submitted` | 请求已发出 |
| `submitted` | `acked` | venue 返回已接收 |
| `submitted` | `submit_unknown` | 超时或执行状态未知 |
| `submitted` | `rejected` | venue 明确拒绝 |
| `acked` | `partially_filled` | 部分成交 |
| `acked` | `filled` | 全部成交 |
| `acked` | `canceled` | 成功撤单 |
| `partially_filled` | `filled` | 剩余成交 |
| `partially_filled` | `canceled` | 剩余撤单 |
| `submit_unknown` | `reconciled_open` | reconcile 找到订单 |
| `submit_unknown` | `reconciled_absent` | reconcile 未找到订单 |
| `reconciled_open` | `acked` | 订单存在 |
| `reconciled_absent` | `rejected` | 确认未成交且未挂单 |

规则：

- `submit_unknown` 不允许盲目重试开仓。
- `filled` 只由 fill ledger 推进，不依赖单条推送消息。
- private WS 接入后也仍然保留 reconcile。

## 5. Canonical Data Model

| 表 | 目的 |
|---|---|
| `users` | 用户 |
| `strategies` | 策略实例 |
| `trading_accounts` | 交易所账户 |
| `webhook_events` | 原始入站账本 |
| `market_states_current` | 每个 market 的最新闭盘状态 |
| `market_states_history` | 历史闭盘状态 |
| `signal_events` | 标准化信号 |
| `agent_runs` | 模型调用审计 |
| `trade_plan_versions` | 计划版本 |
| `plan_transitions` | 计划状态变更 |
| `risk_verdicts` | 确定性风控结果 |
| `execution_intents` | 经批准的执行意图 |
| `orders` | 交易所订单 |
| `fills` | 成交明细 |
| `positions` | 当前与历史仓位 |
| `portfolio_state` | 账户快照 |
| `risk_limits` | 风控配置 |
| `audit_logs` | 业务审计 |

### 5.1 必要唯一约束

| 表 | 约束 |
|---|---|
| `webhook_events` | `delivery_key` unique |
| `market_states_history` | `(tickerid, timeframe, bar_time)` unique |
| `signal_events` | `(strategy_id, tickerid, timeframe, bar_time)` unique |
| `trade_plan_versions` | `(plan_id, version)` unique |
| `plan_transitions` | `(plan_id, version, to_state)` unique |
| `execution_intents` | `idempotency_key` unique |
| `orders` | `(venue, client_order_id)` unique |
| `fills` | `(venue, exchange_fill_id)` unique |

### 5.2 MVP 暂不单独建表

| 暂不建表 | 原因 |
|---|---|
| `cluster_exposure` | 先由 `positions` + `risk_limits` 派生 |
| `portfolio_open_risk` | 先由 `positions` + `risk_verdicts` 派生 |
| private WS event inbox | MVP 不接 private WS |
| 多模型成本明细表 | 先依赖 Gateway 观测与 `agent_runs` |

## 6. 最小事件流

| 事件 | 生产者 | 消费者 |
|---|---|---|
| `tv.payload.received` | Webhook Receiver | Normalizer |
| `market.state.updated` | Normalizer | State Store / Planner |
| `plan.requested` | Signal workflow | Plan Orchestrator |
| `plan.generated` | Plan Orchestrator | Risk Engine |
| `risk.evaluated` | Risk Engine | Approval / Executor |
| `execution.requested` | Approval Service | Venue Adapter |
| `execution.reconcile.requested` | Adapter / cron | Reconciler |
| `execution.terminal` | Reconciler | State Reducer / Dashboard |

## 7. MVP 非目标

- private WS listener
- DCP
- 多交易所
- 多 agent 协作
- 自动调参
- 组合优化
- 向量检索
- 自建回测平台

## 8. 开工条件

满足以下条件即可进入实现：

1. `webhook-payload-v12.schema.json` 通过 contract tests。
2. `trade-plan.schema.json`、`risk-verdict.schema.json`、`execution-intent.schema.json` 已冻结。
3. 数据库迁移严格按本页 canonical data model 落地。
4. 计划状态机和订单状态机的合法转移已进入单测。
5. Bybit 执行层只实现 HTTP submit + REST reconcile。
