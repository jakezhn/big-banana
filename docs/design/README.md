# Design Docs Index

`docs/design` 现在按文档职责分组，避免冻结规格、研究背景和操作手册混在一起。

## 目录结构

- `freeze/`
  - 当前实现冻结规格
- `specs/`
  - 外部协议与输入规范
- `schemas/`
  - 机器可读 JSON Schema
- `research/`
  - 背景研究、取舍分析、工程设计报告
- `runbooks/`
  - 联调和操作手册
- `plans/`
  - 下一阶段开发计划

## 推荐阅读顺序

1. `freeze/mvp-phase-0-freeze.md`
2. `specs/webhook-payload-scheme.md`
3. `plans/mvp-validation-dashboard-plan.md`
4. `runbooks/phase1-paper-smoke-runbook.md`
5. `research/` 下的 3 份背景文档

## 当前关键文档

- 冻结规格：
  - `freeze/mvp-phase-0-freeze.md`
- payload 规范：
  - `specs/webhook-payload-scheme.md`
- schema：
  - `schemas/webhook-payload-v12.schema.json`
  - `schemas/trade-plan.schema.json`
  - `schemas/risk-verdict.schema.json`
  - `schemas/execution-intent.schema.json`
- 联调手册：
  - `runbooks/phase1-paper-smoke-runbook.md`
- MVP 下一阶段计划：
  - `plans/mvp-validation-dashboard-plan.md`
