# MVP Frontend Implementation Audit

## Summary

The current frontend is moving in the right direction for a Bitpunk MVP internal dashboard. It now has a small page/component foundation, a shared formatter module, shared pipeline table, brand assets, global navigation, and a dark trading-intelligence visual system aligned with the brand direction.

It is not yet a complete product design system. The main remaining work is not more decoration; it is hardening page states, data semantics, and operator workflows.

## What Is Reasonable Now

- Next App Router server components fit the current read-only dashboard.
- `cache: "no-store"` matches MVP debugging needs.
- Shared UI primitives reduce page-level repetition.
- Overview and Pipelines now share `PipelineTable`.
- Agent Runs and Market Detail use shared formatting and layout components.
- Brand assets live in `public/assets/brand`, which matches the asset README.
- The UI stays focused on operational scanning rather than a marketing experience.
- The visual system now follows the Bitpunk brand: dark cockpit, sharp panels, cyan system emphasis, and red risk emphasis.

## What Is Not Yet Reasonable

### 1. Debug API Links Need Continued Restraint

Current pages no longer expose API links as hero actions. They now use quieter `DebugLink` affordances in section headers or debug sections.

Remaining concern:

- Debug links are still visible to all users.
- Once auth and user roles exist, developer-only debug links should be gated or hidden.

### 2. Error And Loading States Are Minimal

The app now has route-level `error.tsx`, `loading.tsx`, and a market detail not-found path. This is enough for MVP, but not enough for a production operations console.

Remaining concern:

- Error copy is generic and does not distinguish API, Supabase, auth, or malformed data failures.
- Loading state is intentionally simple and not page-specific.

### 3. Data Freshness Is Basic

Pages now show a "Loaded at" label after the hero.

Remaining concern:

- It uses server render time, not API read-model update time.
- It does not show whether upstream data is stale.

### 4. Status Semantics Are Centralized But Thin

Status tone mapping now lives in `apps/web/src/ui/status.ts`.

Remaining concern:

- The map only defines tone.
- It does not define human labels, ordering, or descriptions.

### 5. Empty State Semantics Are Split

The old mixed `EmptyState` has been split into `TableEmptyState` and `BlockEmptyState`.

Remaining concern:

- Empty states are still text-only.
- They do not distinguish no data from partial data or failed data.

### 6. Market Detail Page Is Still Dense

Raw records are now collapsible under "Debug Records". This improves scanability, but the page remains dense because it is doing both operator summary and developer trace inspection.

Remaining concern:

- Consider moving debug records behind a route segment or tab if the page grows.
- Keep the current single-page trace while backend read models are still unstable.

### 7. Active Nav State Exists

The header nav now marks Overview, Pipelines, and Agent Runs, and treats market detail as part of Pipelines.

Remaining concern:

- This adds one small client component. That is acceptable, but keep all other dashboard pages server-rendered unless interactivity is needed.

### 8. Visual Tokens Are Only In CSS

The tokens are documented and centralized in `globals.css`, and now match the Bitpunk dark brand palette. There is no typed token layer. That is acceptable for MVP.

Next implementation:

- Do not add a full theme framework yet.
- Keep CSS variables as the source of truth.
- Add component-level variants only when the same pattern appears at least twice.

### 9. Tests Are Minimal

There is one formatter test. That is useful but not enough for future changes.

Next implementation:

- Add component tests only when components gain logic.
- Add route smoke tests if the project adopts Playwright or another browser test runner.
- Keep backend API contract tests in API/domain packages, not in web.

## MVP Page Acceptance Criteria

### Overview

Must:

- Render today's totals.
- Render recent pipelines.
- Link to Pipelines, Agent Runs, and relevant API/debug target.

Should improve next:

- Add data freshness.
- Reduce prominence of API link.
- Add route error state.

### Pipelines

Must:

- Render recent pipeline rows.
- Link each row to Market Detail.
- Make status, risk, plan, order fields scannable.

Should improve next:

- Add empty and API failure distinction.
- Add status metadata map.
- Consider a compact result count.

### Agent Runs

Must:

- Show health summary.
- Show latest failure and latest execution-eligible run.
- Show recent run table.

Should improve next:

- Clarify replay vs live semantics in a concise label.
- Consider hiding long errors behind a detail affordance.
- Add status metadata map.

### Market Detail

Must:

- Show execution checklist.
- Show lifecycle timestamps.
- Show current summary.
- Show raw latest records.

Should improve next:

- Collapse raw JSON records.
- Add market not found state.
- Add stronger visual hierarchy between operator summary and debug records.

## Recommended Next Implementation Order

1. Add richer status metadata: label, tone, description, and grouping.
2. Distinguish API unavailable, Supabase unavailable, and market-not-found states.
3. Add result counts and clearer "recent" scope labels to tables.
4. Decide whether debug API links should be role-gated once auth is real.
5. Add route smoke tests if a browser test runner is adopted.
6. Revisit Market Detail information density after the read model stabilizes.

This order keeps the MVP simple while improving the parts that most affect future development quality.
