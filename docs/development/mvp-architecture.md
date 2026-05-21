# MVP Architecture

> 本文是当前 MVP 的主设计文档，合并了原来的 agent 设计、工程设计、可行性研究中的有效部分。重点不是保留历史讨论，而是明确系统应该如何实现、如何部署、以及各层的职责边界。

## 1. 目标与边界

这个项目在 MVP 阶段的真实目标不是“做一个会自动赚钱的机器人”，而是做一条可以被验证、被观察、被修正的交易自动化主链：

`TradingView webhook -> canonical state -> AI trade plan -> deterministic risk -> execution intent -> paper execution -> reconcile`

MVP 只关注：

- Dashboard
- Backend / API
- Database
- AI planner
- Trading execution

MVP 不关注：

- 用户系统
- 订阅等级
- 多租户权限
- 多交易所同时接入
- 多 agent 编排
- 真实 live 交易

## 2. 系统职责边界

系统分成 5 层，每层职责单一。

### 2.1 Webhook ingestion

职责：

- 接收 TradingView webhook
- 校验 schema
- 生成标准化事件
- 幂等入账

它不负责：

- 计划生成
- 风控
- 下单

### 2.2 Market state projection

职责：

- 把 `snapshot` / `signal` 投影成 canonical market state
- 维护 `market_states_current`
- 记录 `market_states_history`

这一层的目标是让 agent 和 dashboard 消费的是统一状态，而不是原始 webhook。

### 2.3 AI planner

职责：

- 基于 market state、signal、已有计划、账户边界生成结构化 `trade_plan`

AI 只负责：

- 是否值得交易
- 交易 thesis
- execution playbook
- risk intent

AI 不负责：

- 最终下单数量
- 杠杆
- 交易所 API
- 仓位真值

### 2.4 Deterministic risk

职责：

- 对计划做机器可解释审批
- 约束风险比例、杠杆、名义金额、止损要求
- 输出 `risk_verdict`

它是 AI 和执行层之间的硬边界。

### 2.5 Execution

职责：

- 把批准后的计划转成 `execution_intent`
- 生成订单
- reconcile 订单终态
- 接受人工干预

当前 MVP 只做：

- paper order submit
- REST-style reconcile
- `flatten_position`
- `cancel_pending_entry`

## 3. 主运行模式

当前 MVP 默认只跑 `full` 模式：

- signal 到达
- 生成 plan
- 通过 risk
- 自动生成 intent
- 自动提交 paper order

`advisory` 模式保留为后续产品能力，但不是当前 MVP 的主目标。

这意味着：

- 当前系统优先验证“自动执行链是否稳定”
- 而不是先做复杂的用户级模式切换

## 4. 数据模型主线

当前已经存在的主表包括：

- `webhook_events`
- `market_states_current`
- `market_states_history`
- `trade_plan_versions`
- `plan_transitions`
- `risk_verdicts`
- `execution_intents`
- `orders`

为了完成下一阶段 MVP，还应继续补：

- `agent_runs`
- `fills`
- `positions_current`
- `positions_history`

它们的优先级高于用户表，因为当前目标是验证策略和执行链，而不是做账户产品化。

## 5. API 与应用结构

当前 API 主要分 4 类：

1. ingestion
   - `/api/webhooks/tradingview`

2. read model
   - `/api/market-pipeline`

3. execution controls
   - `/api/market-pipeline/intervene`
   - `/api/market-pipeline/reconcile`
   - `/api/market-pipeline/submit`

4. environment health
   - `/api/supabase/health`

当前代码结构适合继续保持单仓多应用：

- `apps/web`
  - 前端页面与内容层
- `apps/api`
  - Next.js API routes / webhook / operator actions
- `packages/domain`
- `packages/contracts`
- `packages/db`

如果开始接 Inngest，建议新增：

- `apps/agent`

而不是拆独立 repo。

## 6. 部署设计

### 6.1 当前 MVP 推荐部署

当前最合理的部署拓扑是：

- `Vercel`
  - `apps/web`: dashboard / frontend
  - `apps/api`: API routes / webhook receiver / operator actions

- `Supabase`
  - Postgres
  - schema / ledger / read models
  - 可选 Storage

- `Inngest`
  - 真实 AI planner workflow
  - async reconcile / background jobs
  - 未来的 replay / evaluation jobs

- `Exchange`
  - 先不接真实交易 SDK
  - MVP 只做 paper execution

### 6.2 为什么后端也放在 Vercel

因为当前后端本质上还是：

- Next.js API routes
- dashboard read APIs
- webhook entrypoints

但现在已经把它们从 `apps/web` 中拆到 `apps/api`，这样：

- 前端和 API 可以独立部署
- webhook 与页面渲染生命周期分离
- 后续接 agent / exchange callback 更自然

仍然要注意边界：

- `apps/api` 适合短请求、读 API、webhook 接收
- 长流程、可重试、需要 durable orchestration 的 agent workflow 适合放在 Inngest

### 6.3 为什么 agent 不需要独立 repo

当前不建议为 agent 单独拆仓。

原因：

- domain contracts 共享
- DB schema 共享
- dashboard 和 agent 强耦合
- 拆 repo 会增加版本和部署协调成本

正确做法是：

- 单 repo
- 按应用拆目录
- 按运行时分别部署

### 6.4 未来 live 阶段如何演进

进入真实交易阶段后，执行层可能不再适合完全留在 Vercel。

当出现这些需求时，再考虑单独拆执行服务：

- 固定出口 IP
- 更严格的超时/重试控制
- private websocket
- 常驻连接
- 更高的执行可靠性

那时执行适配层更适合放在：

- Cloud Run
- Fly.io
- Railway
- VM / container

但这不是当前 MVP 的目标。

## 7. Agent 工程设计

当前接入真实 AI planner 时，建议保持一条最小策略：

- 一个 planner agent
- 一个 deterministic risk engine
- 一个 execution adapter

不要在 MVP 阶段引入：

- 多 agent 分工
- planner/reviewer/critic 大图编排
- 复杂记忆层

agent 调用应当具备：

- schema constrained output
- input summary
- output summary
- latency 记录
- 失败记录

也就是后续的 `agent_runs`。

## 8. 人工干预设计

当前已经不再使用 human approval gate。

MVP 的人工控制模型应明确为：

- 系统默认自动执行
- 人工负责随时纠偏

当前保留的最小动作：

- `flatten_position`
- `cancel_pending_entry`

后续若扩展，也应优先扩：

- `reduce_position`
- `move_stop_loss`
- `move_take_profit`

而不是恢复审批队列。

## 9. 设计原则

接下来所有实现都应遵守 4 条原则：

1. 单向主链优先，不做横向扩散。
2. AI 只做计划，不直接做执行。
3. 数据优先服务于验证和复盘，而不是先服务于用户分层。
4. 部署边界按运行时区分，不按 repo 强拆。

## 10. 结论

当前 MVP 的最合理架构是：

- 前端和 API 在 `Vercel`
- 数据在 `Supabase`
- agent workflow 在 `Inngest`
- 执行先保持 paper stub
- 单 repo 多应用部署

一句话概括：

> **MVP 不是先做一套复杂的交易平台，而是先做一套可验证、可观察、可自动执行、可人工修正的交易操作系统。**
