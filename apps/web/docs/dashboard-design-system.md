# Dashboard Design System

## Design Direction

The MVP web UI should feel like a black trading intelligence cockpit: dense, scannable, sharp, and built for repeated inspection. It should avoid marketing-page patterns, oversized decorative sections, random glitch effects, neon-city cyberpunk, and any visual language that feels like hype instead of an auditable signal system.

The current direction is:

- Dark operational surface using the Bitpunk brand palette.
- Cyber cyan for system/running/active signal emphasis.
- Neon red only for risk, rejection, and failure boundaries.
- Compact panels and tables.
- Brand present in the header, with the UI staying subordinate to operational data.
- Raw API/debug access available but visually secondary.

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

### App Header

Elements:

- Bitpunk logo.
- Primary nav: Overview, Pipelines, Agent Runs.

Rules:

- Header is global.
- Header should not include environment controls until auth and deployment environments are defined.
- Active nav state is provided by the client `AppNav` component.
- Active nav uses cyan emphasis, not a bright filled marketing button.

### Page Shell

`PageShell` constrains content width and vertical spacing.

Rules:

- Pages should use `PageShell`.
- Do not create page-local wrappers unless layout requirements are meaningfully different.

### Page Hero

`PageHero` gives each page a short operational purpose and action links.

Rules:

- Use one sentence of copy.
- Actions should be primary page navigation only.
- Debug API links should use `DebugLink` in section headers or debug sections.
- Avoid long onboarding text.
- For MVP, keep hero compact except the Overview page.

### Sections

`Section` groups one operational idea.

Rules:

- Every section should have a clear title unless it contains only the main table immediately following a hero.
- Section actions should be links, not buttons, unless they mutate state.
- Do not nest section panels inside other section panels.

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

- Recent pipelines.
- Recent agent runs.

Rules:

- Keep columns stable across route refreshes.
- Put identifiers in the first column.
- Make drill-down links obvious but not visually dominant.
- Prefer server-side shaping over client-side table logic during MVP.

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
- JSON should move behind collapsible disclosure once pages become too long.
- Do not expose secrets or credentials in raw payloads.

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

- Tables may scroll horizontally.
- Metric grid should use multiple columns.
- Detail grids can use two columns.

Tablet/mobile:

- Header stacks.
- Nav scrolls horizontally if needed.
- Tables remain horizontally scrollable.
- Detail grids collapse to one column.

MVP acceptance: pages must be readable on mobile, but full operational efficiency can remain desktop-first.

## Known Design Gaps

- Route-level loading and error states are intentionally minimal.
- Data freshness is limited to a per-page "Loaded at" label.
- Debug API links are quieter than page navigation, but still visible.
- No documented accessibility checks beyond semantic HTML basics.
- Market Detail raw records are collapsible, but still visually dense.
- The dashboard now matches the Bitpunk dark brand direction, but it still lacks screenshot-based visual QA.
