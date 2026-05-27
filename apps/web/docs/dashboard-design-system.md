# Dashboard Design System

## Design Direction

The MVP web UI should feel like a black trading intelligence cockpit: dense, scannable, sharp, and built for repeated inspection. It should avoid marketing-page patterns, oversized decorative sections, random glitch effects, neon-city cyberpunk, and any visual language that feels like hype instead of an auditable signal system.

The next direction is:

- Dark operational surface using the Bitpunk brand palette.
- Cyber cyan for system/running/active signal emphasis.
- Neon red only for risk, rejection, and failure boundaries.
- Compact panels and tables.
- Brand present in the sidebar shell, with the UI staying subordinate to operational data.
- Raw API/debug access available but visually secondary.
- ChatGPT-like navigation pattern: persistent left sidebar, active right-side canvas.

## Visual Tokens

Current implementation source: `apps/web/app/globals.css`.

Core tokens:

- Background: Void Black `#0A0A0D`.
- Panel: Graphite-like translucent surface.
- Strong panel: Slate-like elevated surface.
- Text: Off White `#E6E8EC`.
- Muted text: low-contrast gray for secondary metadata.
- Accent: Cyber Cyan `#00E5FF`.
- Status good/running/active: cyan.
- Status warn: amber.
- Status bad/risk/failure: Neon Red `#FF2D3D`.
- Panel radius: 12px.
- Card radius: 8px.

MVP rule: add new visual tokens only when at least two components need them.

## Layout System

### App Shell

Elements:

- Resizable left sidebar.
- Bitpunk logo or compact mark at the top of the sidebar.
- Sidebar buttons: Overview, Agent Runs.
- Sidebar label: Markets.
- Sidebar market list from recent pipelines.
- Main canvas for Overview, Agent Runs overview, or selected Market Detail.

Rules:

- The sidebar is global on desktop.
- Sidebar resize should have min/max bounds and should not break table/card layout.
- Active nav uses a cyan rail or subtle filled state, not a bright marketing button.
- Environment controls remain out of scope until auth and deployment environments are defined.
- Mobile can collapse the sidebar later; desktop workflow is the MVP priority.

### Sidebar Market List

Purpose: replace the old top-nav `Pipelines` destination with a scan-first market selector.

Item structure:

- first line: market key or symbol
- second line: timeframe
- optional compact status dot or pill
- optional muted updated timestamp

Rules:

- Latest 50 items are enough for the first implementation.
- Infinite scroll / "load more on bottom" requires backend pagination or cursor support; do not fake it against a fixed `limit=50`.
- Selected market item should remain visible and clearly active.
- Keep list density high enough that a desktop operator can scan many markets quickly.

### Page Shell

`PageShell` becomes the main canvas content wrapper after the sidebar migration.

Rules:

- Pages should use `PageShell`.
- Do not create page-local wrappers unless layout requirements are meaningfully different.
- Remove oversized hero spacing from routine internal views.

### Page Hero

`PageHero` should become a compact canvas header. The old marketing-like hero treatment should be reserved for no regular dashboard route after the sidebar migration.

Rules:

- Use one sentence of copy.
- Actions should be primary page navigation only.
- Debug API links should use `DebugLink` in section headers or debug sections.
- Avoid long onboarding text.
- For MVP, keep all canvas headers compact.

### Sections

`Section` groups one operational idea.

Rules:

- Every section should have a clear title unless it contains only the main table immediately following a hero.
- Section actions should be links, not buttons, unless they mutate state.
- Do not nest section panels inside other section panels.

### Component Loading

API-backed sections should load independently with component-level skeletons.

Rules:

- Keep the final section border, title, and approximate layout visible while data loads.
- Use skeleton/shimmer fills for metric cards, detail cards, and tables.
- Prefer `Suspense` boundaries around async dashboard sections.
- Route-level `loading.tsx` is only the fallback for the whole route.
- Do not use high-intensity neon or red in loading states; loading is neutral system activity, not a warning.
- Do not replace dense dashboards with centered spinners.

## Components

### MetricGrid

Purpose: small quantitative snapshot.

Use for:

- Today totals.
- Run health.
- Current market state.

Rules:

- Labels should be short.
- Values should be already formatted before they enter the component.
- Avoid putting long explanatory text in metric values.

### DataTable

Purpose: primary scan surface.

Use for:

- Recent agent runs.

Rules:

- Keep columns stable across route refreshes.
- Put identifiers in the first column.
- Make drill-down links obvious but not visually dominant.
- Prefer server-side shaping over client-side table logic during MVP.
- Pipeline scanning should move to the sidebar market list rather than remain a primary full-width table.

### StatusPill

Purpose: encode pipeline or run state.

Current implementation source: `apps/web/src/ui/status.ts`.

Current tone mapping:

- Success/terminal/running states: cyan.
- Warning/progress states: amber or cyan.
- Failure/reject states: red.
- Unknown/default: neutral.

Rule: add new statuses through the TypeScript tone map, not one-off page CSS classes.

### DetailList

Purpose: label/value inspection in trace views.

Rules:

- Use for stable facts.
- Keep right-side values short.
- For long text, use callouts instead.

### DetailCard And JsonPre

Purpose: debugging read models.

Rules:

- Raw JSON is acceptable in MVP because backend read models are still changing.
- JSON should stay behind collapsible disclosure by default.
- Do not expose secrets or credentials in raw payloads.

### Market Detail Reasoning Blocks

Purpose: show the complete reasoning chain for the selected market.

Use for:

- Trade Plan.
- Latest Revision.
- Latest Review.

Rules:

- Do not truncate these three text blocks.
- Use dense readable cards, not oversized prose sections.
- Put these blocks near the top, directly under the market overview.
- Metadata can be compact, but reasoning text must remain complete.

### BlockEmptyState And TableEmptyState

Purpose: make missing data explicit.

Rules:

- Use `TableEmptyState` inside table bodies.
- Use `BlockEmptyState` for cards, sections, and non-table contexts.
- Do not reuse one component for both HTML shapes.

## Content Voice

The dashboard should use direct operational language.

Preferred:

- "Recent market pipelines"
- "Execution checklist"
- "Latest failure"
- "Risk verdict"

Avoid:

- Marketing claims.
- Feature explanations inside the app.
- Tutorial copy unless there is a real onboarding flow.

## Responsive Behavior

Desktop:

- Sidebar remains visible and resizable.
- Tables may scroll horizontally.
- Metric grid should use multiple columns.
- Detail grids can use two columns.

Tablet/mobile:

- Sidebar can collapse into a drawer or stack above the canvas.
- Tables remain horizontally scrollable.
- Detail grids collapse to one column.

MVP acceptance: pages must be readable on mobile, but full operational efficiency and sidebar resizing are desktop-first.

## Known Design Gaps

- Route-level error states are intentionally minimal.
- Data freshness is visible, but not yet tied to polling or stale thresholds.
- Debug API links are quieter than page navigation, but still visible.
- No documented accessibility checks beyond semantic HTML basics.
- Market Detail raw records are collapsible, but still visually dense.
- The dashboard now matches the Bitpunk dark brand direction, but it still lacks screenshot-based visual QA.
- Sidebar market list pagination depends on backend pagination or cursor support.
