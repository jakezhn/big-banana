# MVP Frontend Design

> This is the active frontend design document for the current MVP phase. It replaces the earlier `frontend/` v0 input-pack workflow and becomes the main UI source of truth for Codex-led frontend development.

## 1. Scope

This document defines:

- the frontend role inside the current MVP
- the design language derived from `docs/branding`
- the page-by-page UI goals for the existing dashboard
- the implementation boundary inside `apps/web`
- the asset, language, and brand-usage rules for frontend implementation

Current assumption:

- backend API and Hermes worker flow are basically closed for MVP
- frontend work now shifts from "make data visible" to "make the operator experience clear, coherent, and brand-aligned"
- the next UI phase should move from top-level page switching to a ChatGPT-like workspace: persistent left sidebar plus right-side detail canvas

## 2. Product Role

The frontend is not:

- a retail trading app
- a marketing site
- a generic fintech admin panel
- a social or portfolio community product

It is:

> an operator-facing AI trading intelligence cockpit for validating signal -> plan -> risk -> execution -> review

Current product language decision:

- UI copy should default to Chinese
- technical identifiers, market symbols, timestamps, and selected data labels may remain English where that improves clarity

The intended result is:

- Chinese-first operator UI
- not a full Chinese localization exercise
- not mixed-language noise on every card

The UI must help a user answer:

- what is happening now?
- why did Hermes produce this plan?
- is it executable?
- what changed later?
- what did the system learn from it?

## 3. Brand Translation

Brand source materials:

- [Bitpunk 品牌设计文档](</Users/zzz/workspace/big-banana/docs/branding/Bitpunk 品牌设计文档.md>)
- [bitpunk-logo.png](/Users/zzz/workspace/big-banana/docs/branding/bitpunk-logo.png)
- [bitpunk-vi-pc.png](/Users/zzz/workspace/big-banana/docs/branding/bitpunk-vi-pc.png)

The branding direction is clear:

- dark
- sharp
- technical
- auditable
- anti-hype
- systematic

The intended feeling is:

> black trading intelligence console, not neon cyberpunk and not polished consumer fintech

### 3.1 Visual Tone

Use:

- dark backgrounds
- thin borders
- restrained glow
- modular cards
- precise status color
- sharp typography accents in headings only

Avoid:

- soft beige product tone
- playful fintech illustration language
- "crypto moon" visuals
- noisy glitch effects
- decorative red usage
- game-like cyberpunk clichés

### 3.2 Color System

Primary palette:

- `Void Black` `#0A0A0D`
- `Graphite` `#111318`
- `Slate` `#1B1F26`
- `Off White` `#E6E8EC`

Functional palette:

- `Cyber Cyan` `#00E5FF`
- `Neon Red` `#FF2D3D`

Suggested usage:

- cyan = active system / selected / execution-ready / live intelligence
- red = risk / rejection / failure / warning boundary
- neutral grays = layout, tables, inactive sections

### 3.3 Typography

Recommended UI direction from branding:

- interface sans: `Sora`, `Space Grotesk`, or equivalent sharp geometric sans
- data mono: `IBM Plex Mono` or `JetBrains Mono`

Implementation decision for the current MVP:

- use `Sora` for interface headings and major labels
- use a clean sans fallback stack for body copy
- use `IBM Plex Mono` for metrics, IDs, timestamps, symbols, and technical metadata

Rules:

- headings may carry more tension
- body copy must stay clear and quiet
- timestamps, IDs, statuses, and metrics should lean monospace
- do not use the logo-style blade typeface as full UI body typography

### 3.4 Brand Asset Usage Boundary

Primary logo usage:

- use the full `bitpunk.` mark in the app shell, top navigation, or key landing hero
- do not repeat the full logo excessively inside every panel

Monogram usage:

- use `bp.` or a compact mark for compact navigation, avatar-like corners, or favicon contexts

Color usage boundary:

- `Cyber Cyan` should carry "system live / selected / active / execution-ready"
- `Neon Red` should carry "risk / rejection / boundary / fault"
- do not use red as a decorative accent unrelated to risk or failure

Logo-style blade typography:

- only for branding marks or very selective hero moments
- never for dense tables, cards, or paragraph text

## 4. Current UI Gap

The current shipped UI already has useful information architecture, but its layout model is still transitional.

Current strengths:

- real data is visible
- `Agent Runs` and `Market Detail` have meaningful structure
- page hierarchy supports QA and debugging

Current mismatch versus the next MVP operator experience:

- top navigation creates separate destinations, while the operator workflow is closer to "select an item from the left, inspect it on the right"
- `Pipelines` is currently a page, but it should become a market list inside the sidebar
- `Agent Runs` currently has a full table page, but MVP needs the run-health overview globally and market-specific run context inside each market
- `Market Detail` still reads as a long report; the next design should feel like opening a focused technical conversation about one market
- the Bitpunk dark styling is in place, but it can become more compact, precise, and workspace-like

Therefore the next frontend phase should not just tweak cards. It should restructure the shell into a persistent sidebar workspace while preserving the current API contracts and read-model boundaries.

## 4.1 Frontend Asset Location

Frontend runtime assets should live in:

```txt
apps/web/public/assets/
  brand/
  marketing/
  illustrations/
  motion/
```

Branding reference documents may stay in `docs/branding`, but page-consumed assets should be copied or exported into `apps/web/public/assets/**`.

Preference order:

1. SVG for logos and icons
2. optimized PNG/WebP for static imagery
3. motion assets only when they help signal system state, not as decoration

## 5. Frontend Data Boundary

Frontend must stay read-model driven.

Primary sources:

- `DashboardOverviewReadModel`
- `DashboardPipelineListItem`
- `DashboardAgentRunListItem`
- `MarketPipelineReadModel`

Frontend must not invent:

- portfolio analytics not backed by API
- confidence scores not present in read models
- multi-timeframe reasoning views not present in the current MVP
- new plan lifecycle states
- execution controls or account controls that do not exist

## 6. Workspace Model

The next MVP UI should use a ChatGPT-inspired workspace pattern adapted to Bitpunk:

```txt
┌─────────────────────────────┬───────────────────────────────────────────────┐
│ Sidebar                     │ Main canvas                                   │
│                             │                                               │
│ Overview                    │ Overview content, agent-run overview,         │
│ Agent Runs                  │ or selected market detail                     │
│ Markets                     │                                               │
│   BINANCE:BTCUSDT           │                                               │
│   240                       │                                               │
│   BINANCE:SOLUSDT           │                                               │
│   240                       │                                               │
└─────────────────────────────┴───────────────────────────────────────────────┘
```

Navigation rules:

- Refreshing `/` opens `Overview` by default.
- The left sidebar is always visible on desktop.
- `Overview` is the first actual navigation button.
- `Agent Runs` is the second navigation button.
- `Markets` is a text label, not a button.
- The market list below `Markets` shows recent pipeline items.
- Each market item is clickable and opens its market detail in the main canvas.
- The sidebar width should be user-resizable on desktop, with reasonable min/max bounds.
- On narrow screens, the sidebar can collapse into a drawer or stacked top area; desktop is the MVP priority.

Market list item format:

```txt
BINANCE:BTCUSDT
240
```

Rules:

- first line = market symbol/key, visually dominant
- second line = timeframe, muted monospace metadata
- status may be shown as a compact dot or small pill, but must not make the list noisy
- initial load shows the latest 50 pipelines
- scrolling to the bottom should load more once the API supports pagination or cursor-based loading

MVP implementation note:

- if backend pagination is not available yet, implement the list against `limit=50` first and keep the scroll-load behavior as a documented follow-up, not fake UI

## 7. Canvas Content

### 7.1 Overview

Route:

- `/`

Role:

- command-center snapshot

Should feel like:

- first-look operating console

Needs:

- concise KPI cards
- recent activity
- immediate visibility into the latest operating totals
- compact entry points into recent markets

Design note:

- cards should feel terminal-grade and sharp, not "friendly analytics tiles"

### 7.2 Agent Runs

Route:

- `/agent-runs`

Role:

- global planner diagnostics overview

Should feel like:

- incident/debug screen for Hermes outputs

Needs:

- the former `Agent Runs` overview modules:
- recent run health
- latest failure
- latest execution-ready plan
- live/replay/model/market breakdown

Design note:

- this screen should not own all run detail forever
- per-market agent run context belongs in the selected market canvas once the API can query runs by market

### 7.3 Markets List

Route:

- no standalone `Markets` page in MVP

Role:

- sidebar scan surface for pipeline selection

Needs:

- latest 50 pipeline records
- market + timeframe two-line label
- pipeline status
- updated timestamp or freshness hint
- active selected state matching the opened market detail

Design note:

- this replaces the old `Pipelines` page as the primary way to open market detail
- a temporary `/pipelines` route may redirect to `/` or remain as a compatibility page during migration, but it should not be the target IA

### 7.4 Market Detail

Route:

- `/markets/[marketKey]`

Role:

- selected-market workspace, similar to opening a conversation

Should feel like:

- one market, one chain of reasoning, one execution trace

Content order:

1. Market overview at the very top.
2. Full text blocks for `Trade Plan`, `Latest Revision`, and `Latest Review`.
3. Snapshots.
4. Checklist.
5. Lessons.
6. Debug Records.

Rules:

- `Trade Plan`, `Latest Revision`, and `Latest Review` must show complete text, not truncated snippets.
- dense cards are preferred over large hero panels.
- summary and metadata should be compact enough to keep important information above the fold on desktop.
- raw records remain collapsed by default.
- API/debug links remain visible but visually secondary.

### 7.5 Component Loading States

The UI should use component-level loading states instead of a single blank page whenever possible.

Rule:

- when a data component has not fully received its API data, render that component's panel border and layout shell first
- fill the panel with skeleton/shimmer placeholders that suggest the eventual card, table, or detail layout
- replace the skeleton with real content when the async component resolves
- keep skeletons neutral/cyan and low intensity; they should communicate "loading" without feeling like an alert
- do not show spinners as the primary loading pattern for dense dashboard data
- route-level loading can remain as a fallback, but component-level `Suspense` boundaries are preferred for dashboard sections

Design note:

- the market detail canvas is the most important MVP surface
- it should read like a technical investigation thread, not a static report page

## 8. Visual Direction

The next visual direction should combine:

- Bitpunk dark cockpit palette
- ChatGPT-style persistent workspace structure
- compact engineering-console density
- restrained cyber-cyan focus states
- red only for failure/risk boundaries

UI characteristics:

- left sidebar uses deeper black and a clear active rail
- main canvas uses graphite/slate surfaces with thin separators
- transitions are minimal and functional
- hover states should clarify clickability, not create visual noise
- typography stays sharp: Sora/Space Grotesk for UI, IBM Plex Mono for technical metadata
- no oversized marketing hero after the app shell migration

自由发挥方向：

- use a "black terminal workspace with cyan instrumentation" mood, not a literal ChatGPT clone
- add subtle grid/noise only at the shell background level
- keep cards matte and dense; avoid glassmorphism overuse
- make the selected market feel like the active conversation target through a cyan rail, not through a giant bright fill

## 9. Page Implementation Priorities

The frontend should now progress in this order:

1. introduce the sidebar workspace shell and route-aware active state
2. move pipeline selection into the sidebar market list
3. keep `/` as default Overview canvas
4. reduce `Agent Runs` to its overview modules and move market-specific run context into market detail when API support exists
5. refactor `Market Detail` content order and density
6. add sidebar resize behavior
7. manual browser QA and polish

## 10. Repo Boundary

Frontend work should stay inside:

```txt
apps/web/app/**
apps/web/src/**
apps/web/public/assets/**
```

Preferred structure direction:

```txt
apps/web/
  app/
  src/
    components/
      shell/
      overview/
      markets/
      agent-runs/
      market-detail/
      shared/
    dashboard/
      load-dashboard-data.ts
      formatters/
      view-models/
```

Rules:

- keep API contracts stable
- route structure may change only to support the sidebar workspace model
- extract presentational components instead of rewriting the app shell first
- use CSS variables for the Bitpunk visual system

## 11. Frontend Do / Do Not

Do:

- build an operator-first interface
- make the sidebar the primary navigation and selection surface
- use brand colors with discipline
- emphasize state, hierarchy, and traceability
- keep raw debug access available
- make the most important next action or state obvious

Do not:

- turn the app into a generic SaaS dashboard
- copy ChatGPT visuals literally without Bitpunk brand translation
- overuse neon effects
- treat replay and live runs as the same thing visually
- invent missing backend concepts
- bury failures or risk events in secondary UI

## 12. Immediate Next Design Tasks

1. implement persistent resizable sidebar shell
2. replace top nav with sidebar controls
3. render latest 50 pipelines as sidebar market items
4. keep component-level skeleton loading around every API-backed section
5. refactor market detail into overview -> full reasoning text -> snapshots -> checklist -> lessons -> debug
6. keep debug records collapsed and secondary
7. run browser-level QA against API + Supabase-backed data
