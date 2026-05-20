# MVP 验证与 Dashboard 设计

> 本文描述 MVP 下一阶段的产品与工程重点。冻结契约仍以 `../freeze/mvp-phase-0-freeze.md` 为准；本文解决的问题是：在不引入用户系统的前提下，如何尽快验证 AI 交易策略、风控和执行链路是否有效，并把结果可视化。

## 1. 目标重心

当前 MVP 的首要目标不再是扩更多基础模块，而是尽快回答下面 4 个问题：

1. AI 生成的交易计划是否有可用性。
2. deterministic risk 是否能稳定拦截危险计划。
3. 执行链是否能把批准后的计划稳定推到订单终态。
4. 操作台是否能让我们快速看见、解释、修正整条链路。

因此，MVP 的主范围收敛为：

- Dashboard
- Backend / API
- Database / read models
- AI agent
- Trading execution

明确排除出 MVP 主线：

- 用户注册、登录、订阅等级、计费
- 多租户权限
- 完整前台用户产品化
- 多交易所 / 多 agent 编排

## 2. 当前基线

当前仓库已经具备一条可联调的 paper pipeline：

`webhook -> market state -> trade plan -> risk verdict -> execution intent -> order submit -> reconcile`

并且已经验证：

- remote Supabase 可用
- `full` 模式可跑通
- `flatten_position`
- `cancel_pending_entry`
- Supabase health / RLS / migration 基线已建立

这意味着下一步不应继续补更多底层骨架，而应把“验证闭环”补完整。

## 3. MVP 核心设计

### 3.1 单一主模式

MVP 默认只关注 `full` 模式：

- 收到 signal 后生成计划
- 风控通过后自动生成执行意图
- 自动提交 paper order
- 通过 reconcile 推到终态

`advisory` 模式保留为后续产品化能力，但不是当前 MVP 的主验证对象。

### 3.2 AI 只负责计划，不直接掌控执行

AI agent 在 MVP 中的职责仍然保持收敛：

- 输入：canonical market state、signal、已有计划、账户约束
- 输出：严格 schema 化的 `trade_plan`

AI 不直接决定：

- 最终下单数量
- 杠杆
- 是否允许执行
- 交易所 API 调用

这些职责继续由 deterministic risk 与 executor 负责。这样做的原因很简单：如果验证失败，我们要能区分是计划问题、风控问题还是执行问题。

### 3.3 验证优先于“智能感”

MVP 不是先追求更复杂的 agent 行为，而是先建立可验证闭环：

- 每个 signal 都能看到 plan
- 每个 plan 都能看到 risk verdict
- 每个 verdict 都能看到是否生成 intent
- 每个 intent 都能看到订单与终态
- 每次人工干预都能看到结果

如果没有这层可观察性，就算 AI 计划生成已经接入，也无法有效评估。

## 4. 下一阶段系统结构

### 4.1 后端

后端分成 5 段，保持单向主链：

1. Ingestion
   - TradingView webhook
   - 幂等入账
   - 标准化

2. State projection
   - `market_states_current`
   - `market_states_history`

3. Decision pipeline
   - planner
   - risk engine
   - execution intent builder

4. Execution pipeline
   - paper submit
   - reconcile
   - intervention

5. Read API
   - dashboard snapshot
   - timeline / feed
   - intervention controls

### 4.2 数据库

当前已有表足够支撑第一轮 dashboard，但为了验证 AI 有效性，下一步建议优先补 3 类数据：

1. `agent_runs`
   - 记录每次 AI 调用
   - 保存输入摘要、输出摘要、模型、耗时、结果状态
   - 作用：解释“这份计划是怎么来的”

2. `fills`
   - 记录订单成交结果
   - 作用：把“order terminal”继续映射到真实交易结果

3. `positions_current / positions_history`
   - 记录当前仓位与历史仓位变化
   - 作用：支撑 dashboard 上的仓位监控和 intervention

这 3 类数据的优先级高于用户表，因为它们直接服务于策略有效性验证。

### 4.3 Dashboard

Dashboard 不做成泛用产品首页，而做成运营和验证控制台。

最小信息架构建议只做 4 个页面：

1. `Overview`
   - 今日 signals 数
   - 生成 plans 数
   - risk reject 数
   - 自动提交 orders 数
   - filled / canceled 数
   - 当前 open positions 数

2. `Pipeline Monitor`
   - 最近 market pipeline 列表
   - 关键列：
     - market
     - timeframe
     - latest signal time
     - pipeline status
     - plan action
     - risk verdict
     - latest order status

3. `Market Detail`
   - 单个 `market_key` 详情
   - 展示：
     - latest market state
     - latest trade plan
     - risk verdict
     - execution intent
     - order timeline
     - position summary
     - intervention buttons

4. `Agent Runs`
   - 每次 AI plan generation 的列表和详情
   - 展示：
     - model
     - latency
     - input summary
     - output summary
     - validation result
     - linked market / plan / order

UI 原则：

- 先做“能解释系统”，不是做营销页面
- 先做表格和状态卡，不做复杂图表
- 一眼看出哪里卡住、为什么卡住、发生了什么修正

## 5. 验证 AI 有效性的最短路径

如果目标是尽快验证 AI 交易策略，而不是长期产品化，我建议按下面顺序推进。

### 阶段 A：先把可观察性补齐

目标：

- 所有 pipeline 节点可见
- agent 运行可见
- intervention 结果可见

交付：

- dashboard read APIs
- `agent_runs`
- `fills`
- `positions_current / positions_history`

### 阶段 B：接入真实 AI planner

目标：

- 用真实 AI 输出替换 deterministic planner
- 但保持同一份 `trade_plan` schema

要求：

- deterministic risk 不变
- execution pipeline 不变
- dashboard 不变

这样一旦 AI 计划质量有问题，我们能把问题明确归因到 planner，而不是整条链一起漂移。

### 阶段 C：跑 paper validation

目标：

- 持续积累 paper trades
- 观察 plan -> risk -> order -> outcome 的闭环结果

重点观察：

- AI plan 的 `skip` 比例
- risk reject 比例
- order filled 比例
- intervention 频率
- flatten / cancel 是否常见
- 单笔结果和阶段性结果

### 阶段 D：做最小复盘页

目标：

- 能按 market / 日期 / signal 回看整次决策链

页面内容：

- signal payload
- market snapshot
- generated plan
- risk verdict
- execution intent
- orders / fills / position changes
- interventions

这一步会显著提高策略调试速度。

## 6. 建议的开发顺序

下一阶段按这个顺序开发最合理：

1. Dashboard read model 扩展
   - 增加 overview / feed / detail 所需接口

2. `fills` 与 `positions_current / positions_history`
   - 让执行结果能被持续观察

3. `agent_runs`
   - 给真实 AI planner 的接入留出审计位

4. Dashboard 页面
   - `Overview`
   - `Pipeline Monitor`
   - `Market Detail`
   - `Agent Runs`

5. 真实 AI planner 接入
   - 保持输出契约不变
   - 保持 risk / execution 层不变

6. 最小复盘视图
   - 用于判断策略是否值得继续

## 7. 非目标

这一阶段先不做：

- 用户系统
- 订阅与计费
- 用户级 pipeline mode
- 完整 RLS 产品权限设计
- 多交易所适配
- 复杂图表分析页
- 私有 WS 常驻执行层

## 8. 结论

MVP 的下一阶段不应继续围绕“是否还缺底层骨架”展开，而应围绕“是否能尽快验证 AI 策略有效性”展开。

因此，产品重心应明确切到：

- 用现有后端和数据库主链继续跑通 paper execution
- 尽快补出 dashboard 监控与复盘能力
- 接入真实 AI planner，但不改 risk 和 execution 边界
- 用结构化 trace 和结果数据验证 AI 的策略价值

一句话概括：

> **接下来要做的不是更复杂的系统，而是一个能看见、能解释、能复盘、能快速验证 AI 交易效果的操作台。**
