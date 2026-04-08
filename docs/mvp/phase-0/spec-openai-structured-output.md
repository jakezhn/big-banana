# OpenAI Structured Output Schema

这份文档冻结 Phase 0 的 OpenAI structured outputs 方案。

目标不是描述 prompt，而是把模型输出定成可以直接经过校验、映射并落库的 JSON contract。

---

# 1. 设计原则

## 1.1 模型输出不带数据库字段

模型输出中不包含以下字段：

- `id`
- `snapshot_id`
- `trade_plan_id`
- `revision_trade_plan_id`
- `created_at`
- `closed_at`
- 任何 Supabase 内部主键或外键

这些字段都由应用层在拿到模型结果后补齐。

## 1.2 模型输出与持久化对象分层

Phase 0 区分两层 schema：

- LLM task output schema
- database persistence schema

本文件定义的是 LLM task output schema。

数据库字段和表结构以：

- [`phase-0-freeze.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/phase-0-freeze.md)
- [`spec-supabase-postgres-schema.md`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/spec-supabase-postgres-schema.md)

为准。

## 1.3 Phase 0 的 3 类 LLM 输出

Phase 0 只定义 3 类 OpenAI 输出：

1. Event Analyst
2. Plan Writer
3. Plan Reviewer

对应文件：

- [`analysis-card-output.schema.json`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/openai/schemas/analysis-card-output.schema.json)
- [`plan-generation-output.schema.json`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/openai/schemas/plan-generation-output.schema.json)
- [`plan-review-output.schema.json`](/Users/zzz/workspace/big-banana/docs/mvp/phase-0/openai/schemas/plan-review-output.schema.json)

---

# 2. Event Analyst Output

用途：

- 针对单个 `normalized_bar_snapshot` 生成一张 `analysis_card`

输出映射：

- 直接映射到 `analysis_cards`

必含字段：

- `summary_line`
- `detailed_explanation`
- `suggested_bias`
- `confidence`
- `risks`

约束：

- `risks` 必须是字符串数组
- 不输出 markdown code fence
- 不输出多余解释字段

---

# 3. Plan Writer Output

用途：

- 在 rule engine 已判定“值得建计划”之后，生成 `trade_plan` 和 `risk_plan`

输出映射：

- `trade_plan` -> `trade_plans`
- `risk_plan` -> `risk_plans`

说明：

- Phase 0 不要求 Plan Writer 自己返回 `observe_only`
- 是否调用 Plan Writer，由 rule engine 决定
- 因此这个 schema 只描述“确实要创建计划时”该返回什么

`trade_plan.status` 在 Phase 0 的生成阶段只允许：

- `drafted`
- `active_waiting_entry`

这样可以避免生成器直接产出已关闭状态。

---

# 4. Plan Reviewer Output

用途：

- 在每根 confirmed close 到来后，对现有计划给出维护动作

输出映射：

- review 元数据 -> `plan_reviews`
- 若需要 revision，则 `revised_trade_plan` -> 新一行 `trade_plans`
- 若需要 revision 且风险同步变化，则 `revised_risk_plan` -> 新一行 `risk_plans`

说明：

- `action = keep` 时，通常 `revised_trade_plan = null`
- `action = modify` 时，通常应附带 `revised_trade_plan`
- `action = reduce_risk` 时，可以只给 `revised_risk_plan`，也可以两者都给
- `action = invalidate` 时，`new_status` 必须是 `invalidated`
- `action = close_plan` 时，`new_status` 必须是某个 `closed_*` 终态

---

# 5. 应用层映射规则

## 5.1 Analysis Card

应用层补充：

- `snapshot_id`
- `status = completed`
- `model_name`
- `raw_response`

## 5.2 Trade Plan

应用层补充：

- `snapshot_id`
- `symbol`
- `anchor_timeframe`
- `created_at`
- 如果是 revision，则补 `previous_plan_id`

说明：

- `symbol` 和 `anchor_timeframe` 也可以由应用层强制覆盖为输入上下文值，而不是完全信任模型输出

## 5.3 Risk Plan

应用层补充：

- `trade_plan_id`
- `created_at`

## 5.4 Plan Review

应用层补充：

- `trade_plan_id`
- `snapshot_id`
- `revision_trade_plan_id`
- `created_at`

---

# 6. Phase 0 的调用边界

建议调用方式：

1. Event Analyst
   - 输入：单个 snapshot + 轻量上下文
   - 输出：`analysis_card`
2. Plan Writer
   - 输入：snapshot + multi-timeframe context + risk rules
   - 输出：`trade_plan + risk_plan`
3. Plan Reviewer
   - 输入：active plan + new snapshot + multi-timeframe context
   - 输出：`plan_review`，必要时附 revision

Phase 0 不做：

- 让模型直接写数据库
- 让模型返回 SQL
- 让模型自己生成内部 UUID

---

# 7. 后续最可能补的 schema

如果 Phase 1/2 要增强可观测性，最可能新增：

1. `llm_run_output`
2. `system_prompt_version_ref`
3. `plan_candidate_output`

但这些都不属于当前 Phase 0 的最小闭环。
