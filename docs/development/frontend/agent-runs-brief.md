# Agent Runs Brief

## 页面目标

把 `Agent Runs` 做成一个 **planner 调试台**，不是简单日志表。

用户打开这页时，应该能快速回答：

1. 最近 planner 是成功还是失败？
2. 失败主要因为什么？
3. 哪些 run 是 execution-ready 的？
4. 当前更多是 live 还是 replay？
5. 这次 run 对应哪个 market detail？

## 当前页面已有内容

当前页面已经有：

- 顶部 summary cards
- focus 区块
  - latest failure
  - latest execution-ready plan
- mix 区块
  - live / replay / provider / market mix
- runs table

这意味着 v0 不需要从零发明结构，而是可以在现有结构上优化：

- 信息层级
- 布局
- 状态表达
- 表格可读性

## 必须展示的信息

每条 run 至少要能看到：

- marketKey
- operation
- skillName
- runnerKind / modelProvider / model
- promptVersion
- status
- errorMessage
- executionEligible
- latencyMs
- tradePlanVersionId
- startedAt

## 重点优化目标

### 1. 状态优先

页面最先应该强调：

- failed
- invalid_output
- success but not execution-eligible
- success and execution-eligible

### 2. 调试优先

页面不是给普通用户看的，而是给 operator / developer 看的。  
所以应该更像：

- planning diagnostics console

而不是：

- 通用 analytics table

### 3. live vs replay 清楚分开

应该尽量让用户一眼看出：

- 哪些 run 是 live webhook 路径
- 哪些 run 是 replay/eval 路径

### 4. market detail 跳转明确

从 run 跳到对应 `Market Detail` 应该是自然动作。

## 不要发明的内容

- 不要发明新的 planner state
- 不要发明“confidence score”如果后端没有
- 不要假设 replay 一定有单独数据库实体
- 不要做 auth / account 切换
- 不要加入 portfolio analytics

## 视觉方向

- 深色或中性交易终端风格都可以，但不要 crypto hype
- 允许高信息密度
- 强调状态标签和异常项
- 表格允许保留，但要有明显的信息分区

## 最适合 v0 产出的内容

- 页面重排
- 卡片与表格布局
- 状态样式
- 失败态展示
- 可折叠或次级信息层

## Codex 接回仓库时会做的事

- 保持 API 和当前 read model 一致
- 保持现有页面路由不变
- 把 mock/硬编码替换成真实字段
- 修 build / typecheck / regression
