# Frontend Read Models

这份文档只描述当前前端真实消费的数据对象。  
它不是完整 domain 模型，只是 `apps/web` 关心的那部分。

## 1. DashboardOverviewReadModel

用于首页 Overview 卡片。

字段：

```ts
type DashboardOverviewReadModel = {
  signalsTodayCount: number;
  plansTodayCount: number;
  riskRejectsTodayCount: number;
  ordersSubmittedTodayCount: number;
  ordersFilledTodayCount: number;
  ordersCanceledTodayCount: number;
  openPositionsCount: number;
  interventionsTodayCount: number;
};
```

## 2. DashboardPipelineListItem

用于 `/pipelines` 列表页。

字段：

```ts
type DashboardPipelineListItem = {
  marketKey: string;
  tickerid: string;
  timeframe: string;
  updatedAt: string;
  pipelineStatus:
    | "normalized"
    | "plan_ready"
    | "risk_approved"
    | "risk_rejected"
    | "intent_ready"
    | "order_submitted"
    | "order_terminal";
  tradePlanAction:
    | "create"
    | "keep"
    | "patch"
    | "terminate"
    | "skip"
    | null;
  riskVerdict: "approve" | "approve_with_reduction" | "reject" | null;
  latestOrderStatus: string | null;
};
```

UI 含义：

- `marketKey` 是当前页面和跳转的主键
- `pipelineStatus` 是整条链当前所处阶段
- `tradePlanAction` 是当前计划动作
- `riskVerdict` 和 `latestOrderStatus` 用来快速看执行状态

## 3. DashboardAgentRunListItem

用于 `/agent-runs` 页。

字段：

```ts
type DashboardAgentRunListItem = {
  id: string;
  marketKey: string;
  sourceEventKey: string;
  operation: string;
  runnerKind: string;
  modelProvider: string | null;
  model: string | null;
  skillName: string;
  promptVersion: string | null;
  status: "success" | "invalid_output" | "failed";
  tokenUsageJson: JsonValue | null;
  executionEligible: boolean | null;
  tradePlanVersionId: string | null;
  errorMessage: string | null;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
};
```

UI 含义：

- `operation` 目前常见有 `plan.generate`、`plan.replay`
- `runnerKind` 常见是 `deterministic` 或 `openai`
- `skillName` 表示具体 skill 或 market-scoped role
- `executionEligible` 用于判断 planner 输出是否接近可执行
- `errorMessage` 只在失败态重点展示

## 4. MarketPipelineReadModel

用于 `/markets/[marketKey]` 页。

字段：

```ts
type MarketPipelineReadModel = {
  marketKey: string;
  marketState: StoredMarketState | null;
  tradePlanVersion: StoredTradePlanVersion | null;
  latestPlanRevisionSuggestion: StoredPlanRevisionSuggestion | null;
  latestPostPlanReview: StoredPostPlanReview | null;
  memoryLessonCandidates: StoredMemoryLessonCandidate[];
  riskVerdict: StoredRiskVerdict | null;
  executionIntent: StoredExecutionIntent | null;
  latestOrder: StoredOrder | null;
  latestFill: StoredFill | null;
  currentPosition: StoredPositionSnapshot | null;
};
```

页面还会额外收到：

```ts
{
  pipelineStatus: string;
}
```

UI 含义：

- `marketState`：当前 market 的最新事实快照
- `tradePlanVersion`：当前最新计划
- `latestPlanRevisionSuggestion`：最新 revision suggestion
- `latestPostPlanReview`：计划结束后的 review
- `memoryLessonCandidates`：从 review 中提炼出的 scoped lesson candidates
- `riskVerdict`：当前风险结论
- `executionIntent`：系统希望执行的动作
- `latestOrder` / `latestFill` / `currentPosition`：执行真值层

## 5. 不要让 v0 发明的对象

以下对象当前前端没有稳定后端来源，不应发明：

- portfolio PnL dashboard
- strategy performance leaderboard
- real account balance history
- social feed / comments
- auth profile panel
- billing/subscription controls
- live websocket execution tape

## 6. 页面设计时的对象边界

### Agent Runs 页面

最应该围绕：

- `DashboardAgentRunListItem[]`

### Market Detail 页面

最应该围绕：

- `MarketPipelineReadModel`
- `pipelineStatus`

### 不建议

- 让页面直接消费数据库表名
- 让页面根据 domain 猜测不存在的衍生字段
- 在没有后端字段时发明状态机
