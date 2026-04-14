# Observability

这份文档定义 Phase 0 的最小可观测性方案。

它处理两个问题：

1. 是否把可观测性纳入 Phase 0
2. 如果纳入，最小要补哪些对象

结论先行：

- 可观测性不是 Phase 0 主链路必需项
- 但如果你希望减少 AI 调用相关排错成本，建议在 Phase 0 尽快补：
  - `llm_runs`
  - `system_prompt_versions`

因此本文把它们定义为：

- `phase-0 optional but recommended`

---

# 1. 为什么这两张表值得提前补

如果没有这两张表，开发期最常见的问题会很难排：

- 同一类事件为什么这次生成成功、下次失败
- 是 prompt 变了，还是模型行为变了
- 落库失败是模型返回坏 JSON，还是应用映射坏了
- reviewer 为什么给出某个 action
- 哪个 prompt 版本生成了哪条 analysis / plan / review

`llm_runs` 解决：

- 每次 LLM 调用有没有成功
- 模型原始输出长什么样
- 解析后的结构化结果是什么
- 错误发生在哪个阶段

`system_prompt_versions` 解决：

- 某次调用用的是哪版 prompt
- prompt 文本后来改过没有
- output schema 名称和版本对应什么

---

# 2. Phase 0 定位

## 2.1 不把 observability 变成主链路阻塞项

Phase 0 的主链路仍然是：

- ingest
- normalize
- analyze
- plan
- review
- display

可观测性不应阻塞主链路。

因此原则是：

- 主链路成功优先
- observability 写入失败时，只记录 runtime log，不反向打断业务主流程

## 2.2 建议纳入 Phase 0 的范围

建议纳入的最小对象只有：

1. `system_prompt_versions`
2. `llm_runs`

Phase 0 不纳入：

- token billing dashboard
- trace spans
- request replay UI
- prompt diff UI
- model latency analytics page

---

# 3. `system_prompt_versions`

## 3.1 职责

`system_prompt_versions` 用来冻结 prompt 元数据与文本版本。

它记录：

- 任务类型
- prompt 名称
- prompt 版本
- prompt 内容
- 对应 output schema 名称
- 对应 output schema 版本

## 3.2 适用任务类型

Phase 0 冻结 3 种 task：

- `event_analyst`
- `plan_writer`
- `plan_reviewer`

## 3.3 最小字段建议

```json
{
  "id": "uuid",
  "task_type": "event_analyst | plan_writer | plan_reviewer",
  "prompt_name": "string",
  "prompt_version": "string",
  "prompt_body": "string",
  "output_schema_name": "string",
  "output_schema_version": "string",
  "is_active": true,
  "notes": "string | null",
  "created_at": "timestamp"
}
```

## 3.4 唯一性建议

推荐唯一键：

- `(task_type, prompt_version)`

说明：

- `prompt_name` 可以改文案
- 真正稳定引用应尽量用 `task_type + prompt_version`

## 3.5 应用方式

每次调用 Foundry 模型前：

1. 先加载当前 task 对应的 active prompt version
2. 将 prompt 文本与 output schema 一起传入调用层
3. 在 `llm_runs` 中记录 `prompt_version_id`

---

# 4. `llm_runs`

## 4.1 职责

`llm_runs` 用来记录一次完整 LLM 调用。

它关注的是：

- 任务是什么
- 输入是什么
- prompt 版本是什么
- 模型返回了什么
- 解析后结果是什么
- 最终是否成功落库

## 4.2 最小状态集

推荐 `run_status`：

- `started`
- `completed`
- `failed`
- `validation_failed`
- `persistence_failed`

说明：

- `validation_failed` 指模型输出不符合 JSON schema
- `persistence_failed` 指解析成功但数据库写入失败

## 4.3 最小字段建议

```json
{
  "id": "uuid",
  "task_type": "event_analyst | plan_writer | plan_reviewer",
  "run_status": "started | completed | failed | validation_failed | persistence_failed",
  "model_name": "string",
  "provider": "foundry",
  "prompt_version_id": "uuid | null",
  "source_snapshot_id": "uuid | null",
  "source_trade_plan_id": "uuid | null",
  "output_object_type": "analysis_card | trade_plan_bundle | plan_review",
  "output_object_id": "uuid | null",
  "request_payload": {},
  "raw_response": {},
  "parsed_output": {},
  "error_code": "string | null",
  "error_message": "string | null",
  "started_at": "timestamp",
  "completed_at": "timestamp | null"
}
```

## 4.4 字段边界

字段含义冻结为：

- `request_payload`
  - 传给 AI provider 的最终业务输入
  - 不要求 1:1 保存 SDK 原始请求
- `raw_response`
  - 模型原始结构化响应
- `parsed_output`
  - 通过 JSON schema 校验后的对象
- `output_object_type`
  - 本次调用意图产出的对象类别
- `output_object_id`
  - 真正落库成功后写入主对象 id

## 4.5 任务映射

### Event Analyst

- `task_type = event_analyst`
- `source_snapshot_id = 当前 snapshot`
- `source_trade_plan_id = null`
- `output_object_type = analysis_card`

### Plan Writer

- `task_type = plan_writer`
- `source_snapshot_id = 当前 snapshot`
- `source_trade_plan_id = null`
- `output_object_type = trade_plan_bundle`

### Plan Reviewer

- `task_type = plan_reviewer`
- `source_snapshot_id = 当前 snapshot`
- `source_trade_plan_id = 被 review 的 plan`
- `output_object_type = plan_review`

---

# 5. 与主业务对象的关系

`llm_runs` 与业务表关系建议如下：

- `analysis_cards` 不反向依赖 `llm_runs`
- `trade_plans` 不反向依赖 `llm_runs`
- `plan_reviews` 不反向依赖 `llm_runs`

也就是说：

- observability 是辅助层
- 主业务对象不能依赖 observability 才能成立

原因：

- 避免把排错层做成业务强依赖
- 避免 observability 故障拖垮主链路

---

# 6. 推荐写入时机

## 6.1 `system_prompt_versions`

写入时机：

- 新增 prompt 版本时手动写入
- 或通过内部脚本写入

不要求：

- 每次请求动态创建 prompt version

## 6.2 `llm_runs`

推荐时序：

1. 发起 LLM 调用前写一条 `started`
2. 收到原始响应后更新 `raw_response`
3. schema 校验通过后更新 `parsed_output`
4. 业务对象落库成功后更新：
   - `run_status = completed`
   - `output_object_id`
   - `completed_at`
5. 如果中途失败，更新失败状态和错误字段

---

# 7. 错误分类

推荐 `error_code`：

- `openai_request_failed`
- `empty_response`
- `invalid_json`
- `schema_validation_failed`
- `unsupported_status_transition`
- `db_insert_failed`
- `db_update_failed`
- `prompt_not_found`

说明：

- 不需要一开始追求非常细
- 先保证错误类型能按调用阶段分组

---

# 8. Phase 0 推荐 schema 草案

## 8.1 `system_prompt_versions`

```sql
create table public.system_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  prompt_name text not null,
  prompt_version text not null,
  prompt_body text not null,
  output_schema_name text not null,
  output_schema_version text not null,
  is_active boolean not null default false,
  notes text null,
  created_at timestamptz not null default now()
);

create unique index system_prompt_versions_task_version_uniq
  on public.system_prompt_versions (task_type, prompt_version);
```

## 8.2 `llm_runs`

```sql
create table public.llm_runs (
  id uuid primary key default gen_random_uuid(),
  task_type text not null,
  run_status text not null,
  model_name text not null,
  provider text not null default 'openai',
  prompt_version_id uuid null references public.system_prompt_versions(id) on delete set null,
  source_snapshot_id uuid null references public.bar_snapshots(id) on delete set null,
  source_trade_plan_id uuid null references public.trade_plans(id) on delete set null,
  output_object_type text not null,
  output_object_id uuid null,
  request_payload jsonb not null default '{}'::jsonb,
  raw_response jsonb null,
  parsed_output jsonb null,
  error_code text null,
  error_message text null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null
);

create index llm_runs_task_type_started_at_idx
  on public.llm_runs (task_type, started_at desc);

create index llm_runs_run_status_started_at_idx
  on public.llm_runs (run_status, started_at desc);

create index llm_runs_source_snapshot_id_idx
  on public.llm_runs (source_snapshot_id);

create index llm_runs_source_trade_plan_id_idx
  on public.llm_runs (source_trade_plan_id);
```

说明：

- Phase 0 先不强行把 `run_status` 做 enum
- 这两张表是 observability 加层，先保留 text 更灵活

---

# 9. RLS 建议

Phase 0 推荐：

- `system_prompt_versions`
  - `authenticated` 只读
- `llm_runs`
  - browser client 默认不直接读
  - 只允许 service role / server side 调试读取

原因：

- `llm_runs` 可能包含 prompt、输入、模型输出等敏感调试信息
- 不适合直接暴露给前端

---

# 10. 是否需要现在就上 migration

结论：

- 如果你希望先最快打通主链路，可以暂时不加
- 如果你希望减少后面 70% 的排错时间，建议尽快补

推荐策略：

1. 主链路 migration 先维持 0001-0003
2. 如决定纳入 observability，再补：
   - `0004_phase0_observability.sql`

这样不会打乱当前主 schema 节奏。

---

# 11. Phase 0 定案

关于 observability，这里冻结为：

- `llm_runs` 和 `system_prompt_versions` 是 phase 0 可选但强烈建议项
- 它们不阻塞主链路上线
- 它们一旦加入，主链路写入失败不能被 observability 失败反向阻塞
- `llm_runs` 负责单次调用观测
- `system_prompt_versions` 负责 prompt 版本冻结
