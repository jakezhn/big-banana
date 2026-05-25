# Market Detail Brief

## 页面目标

把 `Market Detail` 做成一个 **单 market 计划生命周期页**。

用户打开这页时，应该能快速回答：

1. 当前这条 pipeline 在什么状态？
2. 当前 plan 是什么，为什么是这样？
3. risk / intent / order / fill / position 到了哪一步？
4. 有没有 revision suggestion？
5. 有没有 post-plan review？
6. 有没有 lesson candidates？

## 当前页面已有内容

当前页面已经有：

- checklist
- current execution state
- overview
- active reasoning summary
- lifecycle cards
- scoped lesson candidates
- raw chain records

所以 v0 的任务不是从零设计，而是把这些内容做得更清楚、更稳定、更像 operator 工作台。

## 必须展示的信息

### A. 当前状态

至少必须有：

- pipelineStatus
- ticker
- timeframe
- currentPosition
- latestOrder status
- latestFill

### B. 当前计划

至少必须有：

- tradePlanVersion.action
- tradePlanVersion.executionPlaybook.state
- tradePlanVersion.reasoningSummary
- tradePlanVersion.createdAt

### C. 风险与执行

至少必须有：

- riskVerdict.verdict
- executionIntent
- latestOrder
- latestFill
- currentPosition

### D. 生命周期后续层

至少必须有：

- latestPlanRevisionSuggestion
- latestPostPlanReview
- memoryLessonCandidates

## 重点优化目标

### 1. 决策流清楚

页面应该大致按这个顺序理解：

```text
current state
-> plan
-> risk / execution
-> revision / review / lessons
-> raw trace
```

而不是让用户自己从一堆 JSON 里拼出来。

### 2. 摘要优先，原始记录后置

摘要区应该先帮助人理解：

- 现在发生了什么
- 下一步最重要的状态是什么

原始 JSON 只作为调试区，放在靠后位置。

### 3. 生命周期感要强

这页要看起来像：

- 这条计划从生成到执行到复盘的完整轨迹

而不是：

- 一组孤立数据块

### 4. lesson candidate 不只是 JSON

如果有 lesson candidates，应该更清楚展示：

- lesson 文本
- scope
- confidence
- sample size

## 不要发明的内容

- 不要发明 portfolio 层汇总
- 不要发明多 timeframe 联合 reasoning
- 不要发明不存在的 plan approval flow
- 不要发明 live position controls
- 不要发明未来的 long-term memory UI

## 视觉方向

- 稳定、严肃、偏研究终端
- 信息可以密，但不要乱
- 状态标签要明显
- 允许卡片 + 描述列表 + 调试面板的混合布局

## 最适合 v0 产出的内容

- lifecycle page layout
- information grouping
- summary cards / checklist / timeline-like sections
- lesson candidate presentation
- raw debug section 的层级处理

## Codex 接回仓库时会做的事

- 保持现有 `/markets/[marketKey]` 路由
- 保持真实 `MarketPipelineReadModel` 字段不变
- 修正类型和构建问题
- 保持 raw chain records 作为调试 fallback
