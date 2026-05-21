# MVP Work Tracker

> 这是一份持续维护的开发与测试进度文档。规则很简单：
>
> 1. 每轮大规模开发或测试开始前，先读这份文档。
> 2. 每轮大规模开发或测试结束后，更新这份文档。
> 3. 只记录真正影响 MVP 进度的任务，不记录零碎实现细节。

## 1. 当前阶段定义

当前项目处于：

- 后端 paper trading 主链已跑通
- remote Supabase 联调已完成
- dashboard 尚未开始
- 真实 AI planner 尚未接入

当前 MVP 主目标：

- 尽快验证 AI 交易策略、风控和执行链的有效性
- 尽快做出可监控、可复盘、可干预的 dashboard

当前不作为 MVP 主目标：

- 用户系统
- 订阅等级
- 多租户权限
- 真实 live execution

## 2. 架构拆分

### 2.1 Ingestion

职责：

- TradingView webhook 接收
- schema 校验
- 标准化
- 幂等入账

### 2.2 Market State

职责：

- `snapshot` / `signal` 投影
- canonical market state
- latest / history 视图

### 2.3 Planner / Agent

职责：

- 基于 market state 和 signal 生成 `trade_plan`
- 后续替换为真实 AI planner

### 2.4 Risk

职责：

- deterministic risk 检查
- 生成 `risk_verdict`

### 2.5 Execution

职责：

- 生成 `execution_intent`
- paper order submit
- reconcile
- intervention

### 2.6 Read Models / Dashboard

职责：

- Overview
- Pipeline Monitor
- Market Detail
- Agent Runs

### 2.7 Platform / Deployment

职责：

- Vercel
- Supabase
- Inngest
- 环境变量与联调 runbook

## 3. 开发任务总表

完成度说明：

- `0%` 未开始
- `25%` 已明确设计，尚未进入可用实现
- `50%` 有部分实现，但不能稳定支撑 MVP
- `75%` 主体可用，但还有明显缺口
- `100%` 当前 MVP 范围内已完成

| 模块 | 子任务 | 状态 | 完成度 | 说明 |
|---|---|---:|---:|---|
| Ingestion | TradingView webhook route | 已完成 | 100% | 已支持 schema 校验、标准化、幂等入账 |
| Ingestion | webhook ledger / duplicate handling | 已完成 | 100% | `webhook_events` 已落地 |
| Market State | current/history projection | 已完成 | 100% | `market_states_current/history` 已落地 |
| Planner / Agent | deterministic planner | 已完成 | 100% | 作为真实 AI planner 的占位主链 |
| Planner / Agent | real AI planner 接入 | 未开始 | 0% | 当前还未接模型调用 |
| Planner / Agent | `agent_runs` 审计 | 未开始 | 0% | 需要为真实 AI planner 补齐 |
| Risk | deterministic risk engine | 已完成 | 100% | verdict 生成与持久化已完成 |
| Execution | execution intent pipeline | 已完成 | 100% | 已支持自动 intent 生成 |
| Execution | paper submit | 已完成 | 100% | 已支持自动 paper order submit |
| Execution | reconcile | 已完成 | 100% | 已支持 `filled` / `canceled` |
| Execution | interventions: `flatten_position` | 已完成 | 100% | 已远程联调通过 |
| Execution | interventions: `cancel_pending_entry` | 已完成 | 100% | 已远程联调通过 |
| Execution | `fills` | 未开始 | 0% | 当前只有 order 终态，没有 fill 明细 |
| Execution | `positions_current` | 未开始 | 0% | 当前没有仓位真值表 |
| Execution | `positions_history` | 未开始 | 0% | 当前没有仓位变化历史 |
| Execution | advanced interventions | 未开始 | 0% | `reduce_position` / `move_stop_loss` / `move_take_profit` 未做 |
| Read Models / Dashboard | `GET /api/market-pipeline` 单 market 快照 | 已完成 | 100% | 当前唯一主要 read API |
| Read Models / Dashboard | Overview read API | 未开始 | 0% | 需要新增聚合接口 |
| Read Models / Dashboard | Pipeline Monitor list API | 未开始 | 0% | 需要新增列表接口 |
| Read Models / Dashboard | Market Detail API | 未开始 | 0% | 需要扩当前单 market snapshot |
| Read Models / Dashboard | Agent Runs API | 未开始 | 0% | 依赖 `agent_runs` |
| Frontend | Overview page | 未开始 | 0% | 尚无 dashboard 页面 |
| Frontend | Pipeline Monitor page | 未开始 | 0% | 尚无 dashboard 页面 |
| Frontend | Market Detail page | 未开始 | 0% | 尚无 dashboard 页面 |
| Frontend | Agent Runs page | 未开始 | 0% | 尚无 dashboard 页面 |
| Platform / Deployment | Supabase remote smoke | 已完成 | 100% | 已跑通 remote Supabase |
| Platform / Deployment | RLS / index hardening | 已完成 | 100% | advisor 基线已处理 |
| Platform / Deployment | Supabase SDK framework layer | 已完成 | 100% | health route 已可用 |
| Platform / Deployment | Vercel deployment design | 已完成 | 100% | 已在架构文档明确 |
| Platform / Deployment | Inngest integration | 未开始 | 0% | 目前仅文档设计，没有代码 |
| Platform / Deployment | real exchange adapter | 未开始 | 0% | MVP 仍停留在 paper execution |

## 4. 测试任务总表

| 测试类别 | 子任务 | 状态 | 完成度 | 说明 |
|---|---|---:|---:|---|
| Contracts | webhook / trade-plan / risk-verdict / execution-intent schema tests | 已完成 | 100% | 已有 runtime validator 和 fixtures |
| Domain | ingestion / planner / risk / execution / state machine tests | 已完成 | 100% | 当前核心领域逻辑已有单测 |
| Web | API routes tests | 已完成 | 100% | webhook / market-pipeline / intervene / reconcile 已覆盖主路径 |
| Build | `web` build / typecheck | 已完成 | 100% | 当前构建通过 |
| Integration | remote Supabase health | 已完成 | 100% | 已验证 SDK + DB reachability |
| Integration | remote migrations | 已完成 | 100% | 已执行到 `0007` |
| Integration | full pipeline smoke | 已完成 | 100% | full mode 已联调通过 |
| Integration | `flatten_position` smoke | 已完成 | 100% | 已联调通过 |
| Integration | `cancel_pending_entry` smoke | 已完成 | 100% | 已联调通过 |
| Integration | advisory mode remote test | 未开始 | 0% | 当前 MVP 默认 full，可后置 |
| Integration | real TradingView external webhook | 未开始 | 0% | 目前主要是本地 fixture replay |
| Integration | dashboard manual QA | 未开始 | 0% | 需等页面完成后执行 |
| Integration | real AI planner paper validation | 未开始 | 0% | 依赖 AI planner 接入 |

## 5. 当前已完成的主要里程碑

### 已完成

- webhook ingress 和 ledger
- market state current/history
- deterministic planner
- deterministic risk
- execution intent
- paper submit / reconcile
- minimal interventions
- remote Supabase smoke
- 文档体系收敛

### 当前还缺

- dashboard read models
- dashboard 页面
- `fills`
- `positions_current / positions_history`
- `agent_runs`
- real AI planner

## 6. 当前建议的下一轮开发顺序

严格按下面顺序推进：

1. Overview read API
2. Pipeline Monitor list API
3. `fills`
4. `positions_current / positions_history`
5. Overview page
6. Pipeline Monitor page
7. Market Detail API + page
8. `agent_runs`
9. Agent Runs page
10. real AI planner integration

## 7. 当前建议的下一轮测试顺序

1. 新增 read API 的 route tests
2. `fills` / `positions` 的 domain + db tests
3. dashboard 页面最小手工 QA
4. 页面接入 remote Supabase 的 smoke test
5. real AI planner 接入后的 paper validation

## 8. 本轮状态快照

更新时间：`2026-05-21`

本轮结论：

- 后端和 Supabase 联调已经达到“可验证主链”阶段
- 当前最大缺口是 dashboard 和 AI trace，而不是更多底层交易逻辑
- 下一轮应当优先补“可观察性”，不是优先补更复杂的 agent

## 9. 更新规则

每次更新这份文档时，至少要改 4 处：

1. `开发任务总表`
2. `测试任务总表`
3. `当前已完成的主要里程碑`
4. `本轮状态快照`

如果本轮改变了开发优先级，还要同步修改：

5. `当前建议的下一轮开发顺序`
6. `当前建议的下一轮测试顺序`
