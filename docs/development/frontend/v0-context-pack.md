# v0 Context Pack

## 产品定位

这是一个 **agent-first trading validation dashboard**。

它不是：

- 通用 SaaS 后台
- 营销站
- 社交产品
- 纯交易所终端

它是一个用于验证和监控以下链路的操作台：

```text
signal
-> trade plan
-> risk verdict
-> execution intent
-> order / fill / position
-> agent run
-> revision / review / lesson candidate
```

## 当前 MVP 阶段

当前阶段已经满足：

- 后端 API 基本收尾
- agent-first worker 主链已跑通
- dashboard 已有基础页

当前前端目标不是发明新产品，而是：

- 把现有后端能力表达得更清楚
- 让页面更适合人工 QA、调试和验证

## 当前前端重点

当前优先做：

- `Agent Runs`
- `Market Detail`

后续再扩：

- Overview
- Pipelines
- replay / quality result display

## 视觉和交互原则

- 专业、克制、偏研究终端感
- 信息密度高，但层级必须清楚
- 不要做 crypto hype 视觉
- 不要做花哨 3D 或营销站式 hero
- 保留明显的状态表达：success / failed / watch / armed / order_submitted / order_terminal
- 默认面向 operator，而不是新手用户

## 技术约束

- 前端基于现有 Next.js App Router
- 不要发明新的 backend entity
- 不要改 backend API contract
- 不要加 auth / billing / subscription UI
- 不要把业务逻辑硬编码在组件里
- 如果先用 mock data，也必须和真实 read model 字段一致

## 当前页面目标

### Agent Runs

目标：

- 像一个 planner 调试台
- 能快速看成功/失败、prompt/model、token usage、execution eligibility
- 能快速跳到对应 market detail

### Market Detail

目标：

- 像一个单市场计划生命周期页
- 能快速看当前状态、计划、风险、执行、revision、review、lesson
- 原始 JSON 只作为调试区，不是主信息区

## 不要让 v0 做的事

- 改 API 路由
- 改数据库结构
- 发明新的交易字段
- 把 queue / worker / replay 逻辑做进前端
- 发明不在当前系统里的“智能操作”

## 给 v0 的推荐指令模板

```txt
Design or refactor the frontend for an existing agent-first trading validation dashboard.

This is not a marketing site. It is an operator-facing dashboard.

Use:
- Next.js App Router
- React
- TypeScript
- reusable components

Do not invent backend logic.
Do not add auth, billing, or unrelated product pages.
Do not change the API shape.

Prioritize:
- information hierarchy
- status readability
- compact but clear operator workflows
- responsive layout

Focus only on the page described in the attached brief.
Use the attached read-model document as the source of truth for data shape.
```
