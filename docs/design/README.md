# Design Docs

`docs/design` 现在只保留少量主文档，按内容而不是按来源分类。

## 文档结构

### 1. 冻结与协议

- `mvp-freeze.md`
  - 当前 MVP 的实现冻结规格
- `webhook-payload-spec.md`
  - TradingView 外部 payload 语义与使用规则

### 2. 系统设计

- `mvp-architecture.md`
  - 系统职责边界
  - agent / risk / execution 设计
  - 数据模型
  - 部署拓扑
  - 平台选型

### 3. 验证与产品化

- `mvp-validation-and-dashboard.md`
  - MVP 的验证目标
  - dashboard 信息架构
  - agent 评估与 paper validation 路线
  - 下一阶段开发顺序
- `mvp-work-tracker.md`
  - 开发任务拆分
  - 测试任务拆分
  - 各模块完成度
  - 每轮开发/测试后的进度更新入口

### 4. 操作手册

- `paper-smoke-runbook.md`
  - 远程 Supabase smoke test 手册

### 5. 机器可读契约

- `schemas/webhook-payload-v12.schema.json`
- `schemas/trade-plan.schema.json`
- `schemas/risk-verdict.schema.json`
- `schemas/execution-intent.schema.json`

## 推荐阅读顺序

1. `mvp-freeze.md`
2. `webhook-payload-spec.md`
3. `mvp-architecture.md`
4. `mvp-validation-and-dashboard.md`
5. `mvp-work-tracker.md`
6. `paper-smoke-runbook.md`

## 合并说明

以下旧文档已经按内容合并：

- `trading-agent-design.md`
- `industrial-design-report.md`
- `mvp-feasibility-research.md`
- `mvp-validation-dashboard-plan.md`

它们的核心内容已经吸收到 `mvp-architecture.md` 和 `mvp-validation-and-dashboard.md`。
