# MVP Validation And Dashboard

> 本文定义当前 MVP 的成功标准、验证顺序和 dashboard 设计。它吸收了原来的可行性研究路线和 dashboard 计划，但只保留下一阶段真正需要执行的部分。

## 1. 当前阶段到底要验证什么

当前 MVP 的目标不是证明“策略一定赚钱”，而是尽快验证 4 件事：

1. AI 是否能稳定产出可消费的 `trade_plan`
2. deterministic risk 是否能稳定拦截坏计划
3. execution pipeline 是否能把好计划稳定推进到终态
4. dashboard 是否能让我们快速定位问题并做干预

如果这 4 件事都成立，MVP 就已经具备继续迭代 AI 策略的基础。

## 2. 成功标准

MVP 阶段至少要达到：

- webhook 能稳定入账
- plan / risk / intent / order 链路可观察
- paper execution 能稳定闭环
- intervention 能修正错误状态
- dashboard 能看清最近发生了什么
- AI 运行结果可回放、可归因

## 3. 为什么现在先做 dashboard

当前主链已经能跑，但还不够“可验证”。

如果现在直接接真实 AI planner，而没有足够的 dashboard 和 trace，出了问题只会看到：

- 结果不对
- 但不知道是 agent 错了
- 还是 risk 拦截有问题
- 还是 execution 出错

所以先补 dashboard 和 read model，不是 UI 优先，而是验证优先。

## 4. Dashboard 的职责

Dashboard 在 MVP 中不是营销页，也不是最终用户产品页。

它是运营和验证控制台。

需要完成的事只有 3 类：

1. 看状态
2. 看原因
3. 做修正

## 5. 最小页面结构

### 5.1 Overview

用途：

- 看今天系统总体是否正常

应展示：

- 今日 signals 数
- 生成 plans 数
- risk reject 数
- 自动提交 orders 数
- filled / canceled 数
- open positions 数
- interventions 数

### 5.2 Pipeline Monitor

用途：

- 看最近有哪些市场在流动

应展示：

- `market_key`
- timeframe
- latest signal time
- pipeline status
- trade plan action
- risk verdict
- latest order status

它是日常监控入口。

### 5.3 Market Detail

用途：

- 看单个市场发生了什么

应展示：

- latest market state
- latest trade plan
- latest risk verdict
- latest execution intent
- order timeline
- fills
- current position
- position history
- intervention buttons

它解决的是“这笔交易为什么这样”的问题。

### 5.4 Agent Runs

用途：

- 看 AI planner 每次调用做了什么

应展示：

- run id
- market
- operation
- model
- latency
- input summary
- output summary
- validation result
- linked trade plan / order

它解决的是“AI 这次为什么给出这个计划”的问题。

## 6. 为了 dashboard 必须补的后端能力

### 6.1 Read APIs

需要新增：

- overview 聚合接口
- pipeline monitor 列表接口
- market detail 详情接口
- agent runs 列表与详情接口

### 6.2 数据模型

需要补：

- `agent_runs`
- `fills`
- `positions_current`
- `positions_history`

这些表的价值都高于用户系统。

### 6.3 审计痕迹

至少需要记录：

- AI 输出是否合法
- 订单如何终态
- intervention 做了什么

否则 dashboard 只能展示结果，不能解释原因。

## 7. AI 验证路线

当前接入真实 AI planner 时，建议按这个顺序：

### 阶段 A：保持其余链路不变

只替换 planner：

- deterministic planner -> real AI planner

保持不变：

- risk engine
- execution intent
- submit
- reconcile
- dashboard

这样问题可以被准确归因。

### 阶段 B：积累 paper trades

关注：

- `skip` 比例
- risk reject 比例
- order submitted 比例
- filled / canceled 比例
- intervention 频率

### 阶段 C：复盘单笔链路

按 market / signal / date 回看：

- signal
- market state
- plan
- risk verdict
- execution intent
- order
- fills
- position changes
- intervention

## 8. 下一步开发顺序

建议严格按这个顺序做：

1. `Overview` read model 和 API
2. `Pipeline Monitor` read model 和 API
3. `fills`
4. `positions_current / positions_history`
5. `Overview` 页面
6. `Pipeline Monitor` 页面
7. `Market Detail`
8. `agent_runs`
9. `Agent Runs` 页面
10. 接真实 AI planner

这个顺序的核心是：

- 先把系统变得可见
- 再把系统变得更智能

## 9. 不在当前阶段做的事

这一阶段不做：

- 用户系统
- tier / subscription
- advisory/full 的用户级切换
- 多交易所
- 复杂图表分析页
- 复杂复盘引擎
- private websocket

## 10. 退出条件

当前 MVP 可以认为达到下一阶段入口，当且仅当：

- dashboard 能稳定看见近期 pipeline
- paper execution 数据能沉淀成复盘材料
- agent 输出能被记录和归因
- intervention 能在 UI 上完成
- 我们能用这套系统连续验证一段时间的 AI 策略表现

一句话概括：

> **下一阶段的重点不是把系统做得更大，而是把系统做得足够透明，让 AI 交易策略可以被快速验证、快速复盘、快速修正。**
