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

The next MVP navigation model should be a persistent left-sidebar workspace, similar to ChatGPT's "list on the left, active conversation on the right" pattern, translated into the Bitpunk trading cockpit style.

```txt
Sidebar
  Overview button -> /
  Agent Runs button -> /agent-runs
  Markets label
    latest 50 pipeline items -> /markets/[marketKey]

Main canvas
  Overview
  Agent Runs overview
  Market Detail
```

Rules:

- Refreshing the app should default to `Overview`.
- `Overview` is the first button in the sidebar.
- `Agent Runs` is the second button.
- `Markets` is a label, not a route button.
- Market items are rendered below `Markets` from recent pipeline data.
- The sidebar should be resizable on desktop.
- `/pipelines` is no longer the primary IA target. It can remain temporarily as a compatibility/debug route or redirect after the shell migration.

## Page Responsibilities

### Overview

Purpose: answer "Is the pipeline operating today, and what needs attention first?"

Core modules:

- Compact canvas header with dashboard purpose and freshness.
- Today metrics: signals, plans, risk rejects, orders submitted, filled, canceled, open positions, interventions.
- Recent pipeline summary can remain in the canvas during transition, but the primary market list should move to the sidebar.

MVP constraints:

- No charts until trend/history queries are stable.
- No user personalization.
- No real-time polling unless the backend exposes a clear freshness contract.

### Sidebar Markets

Purpose: answer "Which markets have recent pipeline activity, and what stage are they in?"

Core modules:

- Latest 50 pipeline items.
- Two-line market item label: market on line one, timeframe on line two.
- Compact status indicator.
- Active item state when a market is selected.
- Bottom-scroll loading once API pagination exists.

MVP constraints:

- Keep list read-only.
- Do not fake pagination if the API only supports `limit`.
- Avoid filters until there is query support and a proven operator need.

### Agent Runs

Purpose: answer "Are planner calls healthy at the system level?"

Core modules:

- Run health metrics.
- Latest non-success run.
- Latest execution-eligible run.
- Live/replay/model/market breakdown.

MVP constraints:

- This is an audit page, not an experiment management UI.
- No prompt diff viewer until replay workflow is formalized.
- No token cost dashboard until cost fields are normalized.
- The full recent run table can be removed or demoted during the workspace migration.
- Market-specific agent run records should move into Market Detail once the API can query runs by market.

### Market Detail

Purpose: answer "For this market, what is the latest state across the whole execution chain?"

Core modules:

- Market overview at the top.
- Full Trade Plan text.
- Full Latest Revision text.
- Full Latest Review text.
- Snapshots.
- Execution checklist.
- Lessons.
- Raw latest records for debugging.

MVP constraints:

- Keep raw JSON available because backend read models are still evolving.
- Raw JSON should stay collapsed by default.
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

Loading direction:

- API-backed dashboard sections should use component-level skeletons.
- The section border and heading should render before API data is available.
- Skeletons should approximate the final layout for metric grids, detail cards, and tables.
- Route-level loading remains a fallback, not the primary dashboard loading pattern.

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
