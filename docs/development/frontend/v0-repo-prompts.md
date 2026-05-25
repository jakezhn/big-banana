# v0 Repo Prompts

这份文档提供给 `v0` 的是 **repo-mode prompt**。

和 `brief` 不同，这里的 prompt 假设：

- `v0` 已经接入当前仓库
- 会直接在仓库分支上改代码

## 通用前置说明

每次只做一个页面。  
推荐顺序：

1. `Agent Runs`
2. `Market Detail`

不要在同一个 `v0` 会话里同时做：

- `Agent Runs`
- `Market Detail`
- 全局导航
- 所有 dashboard 页面

## 通用 Repo-Mode Prompt

```txt
You are working inside an existing pnpm monorepo.

This task is frontend-only.
Do not modify backend, database, worker, queue, scripts, or contracts.

Project structure relevant to this task:

apps/web/
  app/
    layout.tsx
    globals.css
    page.tsx
    pipelines/page.tsx
    agent-runs/page.tsx
    markets/[marketKey]/page.tsx
  src/
    api/get-api-base-url.ts
    dashboard/load-dashboard-data.ts

Working scope:
- apps/web/app/**
- apps/web/src/components/**
- apps/web/src/dashboard/**
- apps/web/src/styles/**
- apps/web/app/globals.css

Do not modify:
- apps/api/**
- apps/hermes/**
- packages/**
- scripts/**
- docs/development/** except docs/development/frontend/**
- package.json unless a frontend dependency is absolutely required

This product is an agent-first trading validation dashboard.
It is an operator-facing dashboard, not a marketing site.

Do not invent backend entities.
Do not change API shapes.
Do not add auth, billing, subscriptions, portfolio analytics, or unrelated pages.
Do not move business logic into UI components.

Use the attached frontend read-model document as the source of truth for data shape.
Use the attached page brief as the source of truth for page goals and constraints.

If you need mock or temporary data during refactor, keep field names identical to the real read model.
Prefer extracting presentational components rather than rewriting the whole page into a new architecture.
```

## Agent Runs Repo-Mode Prompt

把以下内容和 `v0-context-pack.md`、`frontend-read-models.md`、`agent-runs-brief.md` 一起给 `v0`：

```txt
Refactor the existing Agent Runs page inside this repo.

Page route:
- apps/web/app/agent-runs/page.tsx

Goal:
- Turn Agent Runs into a planner diagnostics console
- Improve readability, status hierarchy, and debugging flow
- Keep the page grounded in the current backend data model

Required data source:
- DashboardAgentRunListItem[]

Required behaviors:
- Clearly separate failed runs from successful runs
- Make execution-eligible runs easy to spot
- Make live vs replay easy to distinguish
- Keep market detail navigation obvious

Design direction:
- operator-facing
- high information density
- serious terminal-like feel
- compact but legible

Implementation constraints:
- Do not add new routes
- Do not rename existing backend fields
- Do not invent confidence scores or portfolio analytics
- Keep API usage compatible with existing load-dashboard-data flow
- Prefer splitting the page into reusable presentational components under apps/web/src/components/agent-runs/

Output expectation:
- Improve the page layout and component structure
- Preserve compatibility with the existing page route and real data shape
```

## Market Detail Repo-Mode Prompt

把以下内容和 `v0-context-pack.md`、`frontend-read-models.md`、`market-detail-brief.md` 一起给 `v0`：

```txt
Refactor the existing Market Detail page inside this repo.

Page route:
- apps/web/app/markets/[marketKey]/page.tsx

Goal:
- Turn Market Detail into a single-market plan lifecycle page
- Make the decision flow and lifecycle stages easier to read
- Preserve raw records as a debug fallback, but not as the primary experience

Required data source:
- MarketPipelineReadModel
- pipelineStatus

Required behaviors:
- Make current state easy to understand immediately
- Show plan, risk, execution, revision, review, and lesson candidates in a clear order
- Keep raw trace information available lower in the page

Design direction:
- operator-facing
- structured and serious
- timeline/lifecycle feel is good if it remains compact
- summary-first, raw-debug-second

Implementation constraints:
- Do not add new routes
- Do not invent multi-timeframe reasoning UI
- Do not invent portfolio-level controls
- Do not invent live trading controls
- Prefer splitting the page into reusable presentational components under apps/web/src/components/market-detail/

Output expectation:
- Improve information grouping and layout
- Preserve compatibility with the existing page route and real data shape
```

## 给 v0 的附加说明

如果你准备把 `v0` 直接接到分支上，可以再补一句：

```txt
Keep your edits narrow and page-scoped.
Do not refactor unrelated routes, shared runtime code, or backend-facing modules.
```
