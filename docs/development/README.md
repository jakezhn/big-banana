# Development Docs

`docs/development` 只保留开发和运维阶段真正长期有效的工程文档。

## 文档状态

| 文档 | 状态 | 用途 |
|---|---|---|
| `mvp-freeze.md` | frozen reference | 当前冻结契约与硬边界 |
| `webhook-payload-spec.md` | frozen reference | 外部 payload 协议 |
| `mvp-architecture.md` | active | 当前 agent-first MVP 架构 |
| `mvp-agent-first-refactor.md` | active | 当前 staged 重构方案 |
| `mvp-validation-and-dashboard.md` | active | 当前验证和 dashboard 路线 |
| `mvp-work-tracker.md` | active tracker | 每轮开发/测试前后更新 |
| `frontend/*` | active | 给 `v0` 使用的前端输入包与页面 brief |
| `paper-smoke-runbook.md` | active runbook | Supabase / paper / planner 联调 |
| `schemas/*.json` | frozen contracts | 机器可读 schema |
| `archived/*` | archived | 旧 workflow-first 阶段上下文 |

## 文档结构

### 1. 冻结与协议

- `mvp-freeze.md`
  - 当前 MVP 的实现冻结规格
- `webhook-payload-spec.md`
  - TradingView 外部 payload 语义与使用规则

### 2. 系统设计

- `mvp-architecture.md`
  - 当前 agent-first MVP 架构
  - workflow / Supabase / Hermes / guardrail 职责边界
  - 项目结构与数据模型方向
  - 部署拓扑
  - 平台选型
- `mvp-agent-first-refactor.md`
  - 从当前实现迁移到 agent-first 的完整方案
  - 受影响模块
  - staged 重构计划
  - Hermes / skill / memory 边界

### 3. 验证与产品化

- `mvp-validation-and-dashboard.md`
  - agent-first MVP 的验证目标
  - dashboard 信息架构
  - replay / review / agent trace 路线
  - 下一阶段验证顺序
- `mvp-work-tracker.md`
  - 开发任务拆分
  - 测试任务拆分
  - 各模块完成度
  - 每轮开发/测试后的进度更新入口
- `frontend/`
  - 给 `v0` 的前端上下文包
  - 当前 read model 摘要
  - 页面级 brief

### 4. 操作手册

- `paper-smoke-runbook.md`
  - 远程 Supabase smoke test 手册

### 5. 机器可读契约

- `schemas/webhook-payload-v12.schema.json`
- `schemas/trade-plan.schema.json`
- `schemas/risk-verdict.schema.json`
- `schemas/execution-intent.schema.json`

### 6. 归档文档

- `archived/`
  - workflow-first 阶段文档
  - 只作为历史上下文，不作为当前开发计划

## 推荐阅读顺序

1. `mvp-freeze.md`
2. `webhook-payload-spec.md`
3. `mvp-architecture.md`
4. `mvp-agent-first-refactor.md`
5. `mvp-validation-and-dashboard.md`
6. `mvp-work-tracker.md`
7. `paper-smoke-runbook.md`

## 合并说明

以下旧文档已经按内容合并：

- `trading-agent-design.md`
- `industrial-design-report.md`
- `mvp-feasibility-research.md`
- `mvp-validation-dashboard-plan.md`

它们的核心内容已经吸收到 `mvp-architecture.md` 和 `mvp-validation-and-dashboard.md`。

当前 agent-first 阶段已经把旧 workflow-first 主文档归档到 `archived/`。
