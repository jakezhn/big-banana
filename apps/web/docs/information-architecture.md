# Frontend Information Architecture

## Product Position

The web app is an internal MVP validation console for the Bitpunk trading pipeline. It is not a consumer-facing trading product, marketing site, or full operations suite yet.

The current product promise is simple:

- Show whether the paper trading pipeline is alive.
- Help an operator find where a market pipeline is blocked.
- Provide enough audit context to debug planner, risk, order, fill, and position state.
- Keep raw API access one click away during MVP validation.
- Present the product as a black trading intelligence cockpit, not a generic fintech dashboard.

## Primary Users

- Builder/operator: validates webhook ingest, deterministic planner output, risk checks, paper orders, and post-run records.
- Developer/debugger: compares rendered read models with API responses while improving backend pipeline behavior.
- Future reviewer: inspects agent runs, failure reasons, prompt/model metadata, and execution eligibility before AI rollout.

## Navigation Model

The MVP has a shallow navigation model with three top-level sections and one drill-down route.

```txt
Overview (/)
Pipelines (/pipelines)
Agent Runs (/agent-runs)
Market Detail (/markets/[marketKey])
```

The top nav should remain small in MVP. Do not add secondary navigation until there are more than five stable sections.

## Page Responsibilities

### Overview

Purpose: answer "Is the pipeline operating today, and what needs attention first?"

Core modules:

- Page hero with dashboard purpose and links to primary API/debug targets.
- Today metrics: signals, plans, risk rejects, orders submitted, filled, canceled, open positions, interventions.
- Recent pipeline table limited to the latest sample for fast triage.

MVP constraints:

- No charts until trend/history queries are stable.
- No user personalization.
- No real-time polling unless the backend exposes a clear freshness contract.

### Pipelines

Purpose: answer "Which markets have recent pipeline activity, and what stage are they in?"

Core modules:

- Page hero with API link.
- Recent pipeline table with market key, ticker, timeframe, pipeline status, plan action, risk verdict, order status, and updated time.
- Link each market into Market Detail.

MVP constraints:

- Keep list read-only.
- Avoid filtering/sorting UI until there is a concrete operator workflow and query support.
- Prefer one dense table over multiple decorative cards.

### Agent Runs

Purpose: answer "Are planner calls healthy, and which runs need investigation?"

Core modules:

- Run health metrics.
- Latest non-success run.
- Latest execution-eligible run.
- Live/replay/model/market breakdown.
- Full recent run table.

MVP constraints:

- This is an audit page, not an experiment management UI.
- No prompt diff viewer until replay workflow is formalized.
- No token cost dashboard until cost fields are normalized.

### Market Detail

Purpose: answer "For this market, what is the latest state across the whole execution chain?"

Core modules:

- Execution checklist.
- Lifecycle timestamps.
- Current execution snapshot.
- Plan/risk/order/fill/position summary.
- Reasoning summaries.
- Lessons.
- Raw latest records for debugging.

MVP constraints:

- Keep raw JSON visible because backend read models are still evolving.
- Do not add edit/intervention controls until permission and audit rules are defined.
- Do not collapse the page into charts; this page is primarily a trace view.

## Data Freshness

All current pages are server-rendered dynamically and use no-store fetches. That matches MVP debugging because every refresh reflects the current API response.

Future work should define:

- Freshness label: current implementation shows when the page was loaded.
- Manual refresh affordance.
- Optional polling only for pages where operational value exceeds API load.

## Empty And Error States

Current MVP behavior covers empty content, route-level loading, route-level error, and market detail not-found states. This is enough for internal MVP use, but not enough for production operations.

Required next states:

- API unavailable with specific copy.
- Supabase unavailable with specific copy.
- Partial read model missing a downstream record.
- Route-level error with a more specific retry path.

## Out Of Scope For MVP

- Public marketing pages.
- User onboarding.
- Trading action controls.
- Account settings.
- Complex filters, saved views, and custom dashboards.
- Mobile-first operations workflows beyond responsive readability.
