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
- dashboard 核心监控页已完成
- 前后端已拆分为 `apps/web` 与 `apps/api`
- 真实 AI planner 已通过 Vercel AI Gateway 完成 paper validation
- MVP 新阶段切换为 agent-first refactor

当前 MVP 主目标：

- 最大化 Hermes/LLM 在分析、计划、修正、复盘中的作用
- 保留 workflow、Supabase、deterministic guardrail 作为可靠 harness
- 建立可 replay、可评估、可复盘的 agent quality loop

当前不作为 MVP 主目标：

- 用户系统
- 订阅等级
- 多租户权限
- 真实 live execution
- 自动写入长期 vector memory

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

- 基于 market state、signal、recent context、active plan 和 position/order context 生成 `trade_plan`
- 后续扩展为 Hermes analysis / planning / revision / review / memory curation

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

- `apps/web`
- `apps/api`
- future `apps/hermes`
- Supabase
- VPS / Docker worker
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
| Planner / Agent | real AI planner 接入 | 已完成 | 100% | 已接入 `deterministic | openai` runtime，并完成 Vercel AI Gateway paper validation |
| Planner / Agent | `agent_runs` 审计 | 已完成 | 100% | 当前已记录 planner run 审计基线 |
| Planner / Agent | agent-first design docs | 已完成 | 100% | 已建立 agent-first 主架构、重构计划与归档结构 |
| Planner / Agent | `PlannerInput` context v2 | 未开始 | 0% | 待补 `recentSnapshots`、`windowSummary`、active plan、position/order context |
| Planner / Agent | planner quality iteration loop | 未开始 | 0% | 待补 replay / prompt tuning / plan quality review，验证策略质量而不只是链路连通性 |
| Planner / Agent | plan revision agent | 未开始 | 0% | 待补 `plan_revision_suggestions` 与 `plan.revise` |
| Planner / Agent | post-plan review agent | 未开始 | 0% | 待补 `post_plan_reviews` 与 `plan.review` |
| Planner / Agent | memory lesson candidates | 未开始 | 0% | 待补 scoped lesson candidates；不自动写长期 memory |
| Planner / Agent | multi-Hermes router | 未开始 | 0% | 待按 market/job type 路由 Global/Crypto/US Equity/CN Equity/Commodity Hermes |
| Risk | deterministic risk engine | 已完成 | 100% | verdict 生成与持久化已完成 |
| Execution | execution intent pipeline | 已完成 | 100% | 已支持自动 intent 生成 |
| Execution | paper submit | 已完成 | 100% | 已支持自动 paper order submit |
| Execution | reconcile | 已完成 | 100% | 已支持 `filled` / `canceled` |
| Execution | interventions: `flatten_position` | 已完成 | 100% | 已远程联调通过 |
| Execution | interventions: `cancel_pending_entry` | 已完成 | 100% | 已远程联调通过 |
| Execution | `fills` | 已完成 | 100% | `filled` reconcile 已写入 fill 明细 |
| Execution | `positions_current` | 已完成 | 100% | 已维护当前仓位真值表 |
| Execution | `positions_history` | 已完成 | 100% | 已在 fill 驱动下追加仓位历史 |
| Execution | advanced interventions | 未开始 | 0% | `reduce_position` / `move_stop_loss` / `move_take_profit` 未做 |
| Read Models / Dashboard | `GET /api/market-pipeline` 单 market 快照 | 已完成 | 100% | 当前唯一主要 read API |
| Read Models / Dashboard | Overview read API | 已完成 | 100% | `/api/dashboard/overview` 已可用 |
| Read Models / Dashboard | Pipeline Monitor list API | 已完成 | 100% | `/api/dashboard/pipelines` 已可用 |
| Read Models / Dashboard | Market Detail API | 已完成 | 100% | 当前 market snapshot 已扩到 fill / position |
| Read Models / Dashboard | Agent Runs API | 已完成 | 100% | `/api/dashboard/agent-runs` 已可用 |
| Frontend | Overview page | 已完成 | 100% | `/` 已提供 overview cards 和 recent pipelines |
| Frontend | Pipeline Monitor page | 已完成 | 100% | `/pipelines` 已提供列表页 |
| Frontend | Market Detail page | 已完成 | 100% | `/markets/[marketKey]` 已可查看完整链路 |
| Frontend | Agent Runs page | 已完成 | 100% | `/agent-runs` 已可查看 planner runs |
| Platform / Deployment | Supabase remote smoke | 已完成 | 100% | 已跑通 remote Supabase |
| Platform / Deployment | RLS / index hardening | 已完成 | 100% | advisor 基线已处理 |
| Platform / Deployment | Supabase SDK framework layer | 已完成 | 100% | health route 已可用 |
| Platform / Deployment | `apps/web` / `apps/api` split | 已完成 | 100% | 前端与 API 已拆分为两个独立 app |
| Platform / Deployment | Vercel deployment design | 已完成 | 100% | 已在架构文档明确 |
| Platform / Deployment | `packages/agent` extraction | 未开始 | 0% | 待把 LLM prompt/model/skill 代码从 `apps/api` 中抽出 |
| Platform / Deployment | Supabase `agent_jobs` queue | 未开始 | 0% | 待补 job table、idempotency、retry、timeout recovery |
| Platform / Deployment | worker lock helpers | 未开始 | 0% | 待补 symbol / plan / account / execution lock |
| Platform / Deployment | `apps/hermes` Docker worker | 未开始 | 0% | 待补 VPS worker runtime、polling loop、job router |
| Platform / Deployment | dashboard realtime refresh path | 未开始 | 0% | 待确定 `Broadcast -> API re-fetch` 为主路径，`Postgres Changes` 仅作早期替代 |
| Platform / Deployment | Inngest integration | 后置可选 | 0% | 降级为不用 VPS 时的 managed workflow 备选方案 |
| Platform / Deployment | real exchange adapter | 未开始 | 0% | MVP 仍停留在 paper execution |

## 4. 测试任务总表

| 测试类别 | 子任务 | 状态 | 完成度 | 说明 |
|---|---|---:|---:|---|
| Contracts | webhook / trade-plan / risk-verdict / execution-intent schema tests | 已完成 | 100% | 已有 runtime validator 和 fixtures |
| Domain | ingestion / planner / risk / execution / state machine tests | 已完成 | 100% | 当前核心领域逻辑已有单测 |
| Web | API routes tests | 已完成 | 100% | 已覆盖 webhook / market-pipeline / dashboard / intervene / reconcile 主路径 |
| Build | `web` build / typecheck | 已完成 | 100% | 当前构建通过 |
| Integration | remote Supabase health | 已完成 | 100% | 已验证 SDK + DB reachability |
| Integration | remote migrations | 已完成 | 100% | 已补到 `0008` 脚本与 runbook |
| Integration | full pipeline smoke | 已完成 | 100% | full mode 已联调通过 |
| Integration | `flatten_position` smoke | 已完成 | 100% | 已联调通过 |
| Integration | `cancel_pending_entry` smoke | 已完成 | 100% | 已联调通过 |
| Integration | advisory mode remote test | 未开始 | 0% | 当前 MVP 默认 full，可后置 |
| Integration | real TradingView external webhook | 未开始 | 0% | 目前主要是本地 fixture replay |
| Integration | dashboard manual QA | 未开始 | 0% | 页面已完成第一阶段，但尚未做联调级手工验证 |
| Integration | real AI planner paper validation | 已完成 | 100% | 已完成 Vercel AI Gateway -> plan -> risk -> intent -> order -> reconcile 闭环验证 |
| Integration | context v2 replay | 未开始 | 0% | 待建立 recent context 后的 replay 验证 |
| Integration | plan revision smoke | 未开始 | 0% | 待 plan revision agent 落地 |
| Integration | post-plan review smoke | 未开始 | 0% | 待 post-plan review agent 落地 |

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
- Overview API / page
- Pipeline Monitor API / page
- fills / positions current/history
- Market Detail API / page
- agent_runs audit
- Agent Runs API / page
- `apps/web` / `apps/api` split
- 文档体系收敛
- agent-first 文档与归档结构

### 当前还缺

- `PlannerInput` context v2
- planner quality iteration loop
- plan revision agent
- post-plan review agent
- scoped lesson candidates
- advanced interventions
- Supabase `agent_jobs` queue and worker locks
- `apps/hermes` Docker worker
- dashboard realtime refresh wiring
- optional Inngest fallback

## 6. 当前建议的下一轮开发顺序

严格按下面顺序推进：

1. `PlannerInput` context v2: `recentSnapshots` + `windowSummary` + position/order context
2. Supabase `agent_jobs` queue + worker lock helpers
3. `apps/hermes` Docker worker baseline
4. agent run evaluation metadata and replay harness
5. planner quality iteration loop
6. multi-Hermes router
7. plan revision agent
8. post-plan review agent
9. scoped lesson candidates

## 7. 当前建议的下一轮测试顺序

1. `PlannerInput` context v2 unit tests
2. agent job enqueue / claim / retry tests
3. `apps/hermes` worker local smoke
4. multi-market AI replay smoke
5. dashboard Agent Runs / Market Detail manual QA
6. plan revision smoke
7. post-plan review smoke
8. real TradingView external webhook

## 8. 本轮状态快照

更新时间：`2026-05-24`

本轮结论：

- 后端和 Supabase 联调已经达到“可验证主链”阶段
- dashboard 第三阶段已落地：`Agent Runs` 可用
- 执行结果真值层已补齐：`fills`、`positions_current`、`positions_history`
- planner 审计层已补齐：`agent_runs` 已落地
- real AI planner 代码接入面已落地：支持 `PLANNER_RUNTIME=openai`
- 本轮已完成 Vercel AI Gateway 真实联调，修复了 Responses JSON Schema 兼容层
- 已验证 `runnerKind=openai` 成功落库，并完成 `plan -> risk -> intent -> order -> reconcile` 闭环
- 额外修复了“AI plan 合法但暂不可执行时 route 返回 500”的降级问题
- 当前已完成 agent-first 文档收口：旧 workflow-first 主文档已归档，新主架构和 staged refactor plan 已建立
- 当前部署主路径更新为 `Vercel + Supabase + VPS Hermes Docker`；Inngest 降级为可选备选方案
- 当前已明确：逻辑 multi-Hermes 与物理多容器不是同一件事，MVP 先做单 `apps/hermes` worker baseline
- 当前已明确：`agent_jobs` 的正确性依赖 durable queue polling；Supabase realtime 只负责前端刷新和可选 worker 唤醒
- 当前主线阻塞已从“真实 AI planner 接入”转移到“context v2、Supabase job queue、Hermes worker、策略质量迭代、plan revision、post-plan review”

## 9. 更新规则

每次更新这份文档时，至少要改 4 处：

1. `开发任务总表`
2. `测试任务总表`
3. `当前已完成的主要里程碑`
4. `本轮状态快照`

如果本轮改变了开发优先级，还要同步修改：

5. `当前建议的下一轮开发顺序`
6. `当前建议的下一轮测试顺序`
