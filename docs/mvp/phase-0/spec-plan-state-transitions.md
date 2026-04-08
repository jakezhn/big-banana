# Plan State Transitions

这份文档把 Phase 0 的 `trade_plan.status` 与 `plan_review.action` 状态转移规则冻结下来。

目标是解决两个问题：

1. 哪些动作在什么状态下是允许的
2. 一个动作会把计划推进到哪个状态

如果本文与以下文档冲突，以本文为准：

- [`phase-0-freeze.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/phase-0-freeze.md)
- [`spec-openai-structured-output.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/spec-openai-structured-output.md)
- [`spec-supabase-postgres-schema.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/spec-supabase-postgres-schema.md)

---

# 1. 状态集

Phase 0 的 `trade_plan.status` 固定为：

- `drafted`
- `active_waiting_entry`
- `active_entered`
- `active_scaling_out`
- `closed_tp`
- `closed_sl`
- `closed_manual_rule`
- `invalidated`
- `expired`

其中：

- `closed_tp`
- `closed_sl`
- `closed_manual_rule`
- `invalidated`
- `expired`

都是终态。

---

# 2. 动作集

Phase 0 的 `plan_review.action` 固定为：

- `keep`
- `modify`
- `reduce_risk`
- `partial_take_profit`
- `invalidate`
- `close_plan`

动作含义：

- `keep`：计划继续，不做结构性修改
- `modify`：计划结构被更新，通常产生 revision
- `reduce_risk`：计划方向未变，但风险约束更保守
- `partial_take_profit`：已进场计划执行部分止盈
- `invalidate`：thesis 被破坏或 setup 过期，计划失效
- `close_plan`：计划进入某个 `closed_*` 终态

---

# 3. 核心原则

## 3.1 状态与动作分层

- `trade_plan.status` 是生命周期状态
- `plan_review.action` 是当前 bar 上的维护动作

## 3.2 终态不可再迁移

一旦进入以下状态，不再接受新的 review 动作：

- `closed_tp`
- `closed_sl`
- `closed_manual_rule`
- `invalidated`
- `expired`

## 3.3 `modify` 不必然改变状态

`modify` 可以：

- 保持原状态不变
- 或把 `drafted` 推进到 `active_waiting_entry`
- 或把 `active_waiting_entry` 推进到 `active_entered`

但它不能直接把计划送入 `closed_*` 终态。

## 3.4 `close_plan` 必须进入 closed 终态

`close_plan` 的 `new_status` 只能是：

- `closed_tp`
- `closed_sl`
- `closed_manual_rule`

## 3.5 `invalidate` 必须进入 `invalidated`

`invalidate` 的 `new_status` 必须是：

- `invalidated`

---

# 4. 允许的状态转移

## 4.1 创建阶段

新计划创建时，生成器只允许输出：

- `drafted`
- `active_waiting_entry`

不允许创建时直接输出：

- `active_entered`
- `active_scaling_out`
- 任何终态

## 4.2 Review 阶段总表

| 当前状态 | 允许动作 | 目标状态 |
| --- | --- | --- |
| `drafted` | `keep` | `drafted` |
| `drafted` | `modify` | `drafted` or `active_waiting_entry` |
| `drafted` | `reduce_risk` | `drafted` |
| `drafted` | `invalidate` | `invalidated` |
| `drafted` | `close_plan` | `closed_manual_rule` |
| `active_waiting_entry` | `keep` | `active_waiting_entry` |
| `active_waiting_entry` | `modify` | `active_waiting_entry` or `active_entered` |
| `active_waiting_entry` | `reduce_risk` | `active_waiting_entry` |
| `active_waiting_entry` | `invalidate` | `invalidated` |
| `active_waiting_entry` | `close_plan` | `closed_manual_rule` |
| `active_entered` | `keep` | `active_entered` |
| `active_entered` | `modify` | `active_entered` or `active_scaling_out` |
| `active_entered` | `reduce_risk` | `active_entered` or `active_scaling_out` |
| `active_entered` | `partial_take_profit` | `active_scaling_out` |
| `active_entered` | `invalidate` | `invalidated` |
| `active_entered` | `close_plan` | `closed_tp` or `closed_sl` or `closed_manual_rule` |
| `active_scaling_out` | `keep` | `active_scaling_out` |
| `active_scaling_out` | `modify` | `active_scaling_out` |
| `active_scaling_out` | `reduce_risk` | `active_scaling_out` |
| `active_scaling_out` | `partial_take_profit` | `active_scaling_out` |
| `active_scaling_out` | `invalidate` | `invalidated` |
| `active_scaling_out` | `close_plan` | `closed_tp` or `closed_sl` or `closed_manual_rule` |

## 4.3 不允许的动作

以下动作明确不允许：

- `partial_take_profit` 用于 `drafted`
- `partial_take_profit` 用于 `active_waiting_entry`
- `partial_take_profit` 直接进入 `closed_*`
- `reduce_risk` 用于任何终态
- `modify` 用于任何终态
- `keep` 用于任何终态

---

# 5. 各状态的业务定义

## 5.1 `drafted`

含义：

- thesis 已成立
- 计划已创建
- 但仍偏观察或待确认

典型来源：

- Plan Writer 产出保守计划
- review 后把过于激进的 entry 退回观察态

## 5.2 `active_waiting_entry`

含义：

- 计划有效
- entry 方案已定义
- 但尚未视为成交或执行完成

## 5.3 `active_entered`

含义：

- 计划已进入执行中阶段
- 关注维护、止盈、止损、风险收缩

说明：

- Phase 0 不接真实交易执行
- 这个状态可以由 review 逻辑基于 price behavior 或模拟填单语义推进

## 5.4 `active_scaling_out`

含义：

- 已经至少发生一次部分止盈
- 剩余仓位仍按 thesis 继续管理

## 5.5 终态

### `closed_tp`

- 计划按止盈逻辑结束

### `closed_sl`

- 计划按止损或结构失守结束

### `closed_manual_rule`

- 计划因规则关闭，而不是明确 TP/SL
- 例如 setup stale、到期、策略主动放弃

### `invalidated`

- thesis 被破坏
- 计划失效
- 对未成交计划尤其常见

### `expired`

- 计划未必被结构击穿，但生命周期超时
- Phase 0 允许由非 review 的定时规则推进到 `expired`

---

# 6. 动作判定规则

## 6.1 `keep`

适用条件：

- thesis 仍有效
- 没有需要更新的 entry / risk / TP / invalidation

要求：

- `changed_fields` 应为空数组
- `new_status` 通常等于当前状态

## 6.2 `modify`

适用条件：

- thesis 仍有效
- 但计划内容需要结构性更新

常见场景：

- 调整 entry zone
- 调整 TP 阶梯
- 调整 invalidation 文案
- 从 `drafted` 升到 `active_waiting_entry`
- 从 `active_waiting_entry` 升到 `active_entered`

要求：

- `changed_fields` 不能为空
- 通常应附带 `revised_trade_plan`

## 6.3 `reduce_risk`

适用条件：

- thesis 尚未完全失效
- 但风险条件恶化，需要更保守

常见场景：

- 高周期冲突增强
- 动量衰减
- 接近第一目标位前出现背离

要求：

- 可以只改 `risk_plan`
- 也可以同时附带 `revised_trade_plan`

## 6.4 `partial_take_profit`

适用条件：

- 计划已处于已进场执行态
- 价格触及分批止盈条件

要求：

- 当前状态必须是 `active_entered` 或 `active_scaling_out`
- `new_status` 必须是 `active_scaling_out`

## 6.5 `invalidate`

适用条件：

- thesis 被破坏
- 或 setup 已失去成立基础

常见场景：

- anchor timeframe 结构失守
- 上下级周期共振反转
- 未成交 setup 已明显过期

要求：

- `new_status` 必须是 `invalidated`
- 如果当前是未成交计划，通常优先用 `invalidate` 而不是 `close_plan`

## 6.6 `close_plan`

适用条件：

- 计划不再活跃，但原因属于明确关闭而非简单失效

常见场景：

- 达成最终 TP
- 触发 stop
- 到达策略定义的 manual exit rule

要求：

- `new_status` 只能是 `closed_tp`、`closed_sl`、`closed_manual_rule`

---

# 7. `plan_review.action` 到 `new_status` 的约束

| `action` | 合法 `new_status` |
| --- | --- |
| `keep` | 当前状态本身 |
| `modify` | 非终态，且必须是允许迁移目标 |
| `reduce_risk` | 当前状态本身 or `active_scaling_out` |
| `partial_take_profit` | `active_scaling_out` |
| `invalidate` | `invalidated` |
| `close_plan` | `closed_tp` or `closed_sl` or `closed_manual_rule` |

---

# 8. 应用层执行规则

## 8.1 Review 落库顺序

当收到一个合法 review 输出时，推荐顺序：

1. 校验 `action`
2. 校验 `current_status -> new_status` 是否在允许矩阵内
3. 如有 `revised_trade_plan`，先插入新的 `trade_plans`
4. 如有 `revised_risk_plan`，插入新的 `risk_plans`
5. 写入 `plan_reviews`
6. 将当前激活中的 plan 指针切换到 revision plan

## 8.2 非法输出处理

如果模型输出违反状态机：

- 不直接落库
- 记一条应用层错误日志
- 该次 review 视为失败

典型非法例子：

- `action = partial_take_profit` 但当前状态是 `drafted`
- `action = close_plan` 但 `new_status = invalidated`
- `action = invalidate` 但 `new_status = closed_sl`

---

# 9. 典型例子

## 9.1 未成交 setup 过期

```txt
current_status = active_waiting_entry
action = invalidate
new_status = invalidated
```

## 9.2 已进场后部分止盈

```txt
current_status = active_entered
action = partial_take_profit
new_status = active_scaling_out
```

## 9.3 已进场后打止损

```txt
current_status = active_entered
action = close_plan
new_status = closed_sl
```

## 9.4 计划仍有效但需要收紧风险

```txt
current_status = active_entered
action = reduce_risk
new_status = active_entered
```

## 9.5 计划内容调整但仍未成交

```txt
current_status = drafted
action = modify
new_status = active_waiting_entry
```

---

# 10. Phase 0 定案

进入 Phase 1 前，以下内容视为已冻结：

- 终态不可再 review
- `invalidate -> invalidated`
- `close_plan -> closed_*`
- `partial_take_profit` 只允许从已进场状态进入 `active_scaling_out`
- 创建阶段只允许从生成器产出 `drafted` 或 `active_waiting_entry`
- 所有 review 输出都必须经过状态机校验后才能落库
