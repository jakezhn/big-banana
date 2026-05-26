# MVP Frontend Design

> This is the active frontend design document for the current MVP phase. It replaces the earlier `frontend/` v0 input-pack workflow and becomes the main UI source of truth for Codex-led frontend development.

## 1. Scope

This document defines:

- the frontend role inside the current MVP
- the design language derived from `docs/branding`
- the page-by-page UI goals for the existing dashboard
- the implementation boundary inside `apps/web`

Current assumption:

- backend API and Hermes worker flow are basically closed for MVP
- frontend work now shifts from "make data visible" to "make the operator experience clear, coherent, and brand-aligned"

## 2. Product Role

The frontend is not:

- a retail trading app
- a marketing site
- a generic fintech admin panel
- a social or portfolio community product

It is:

> an operator-facing AI trading intelligence cockpit for validating signal -> plan -> risk -> execution -> review

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

Rules:

- headings may carry more tension
- body copy must stay clear and quiet
- timestamps, IDs, statuses, and metrics should lean monospace
- do not use the logo-style blade typeface as full UI body typography

## 4. Current UI Gap

The current shipped UI already has useful information architecture, but its visual language is still transitional.

Current strengths:

- real data is visible
- `Agent Runs` and `Market Detail` have meaningful structure
- page hierarchy supports QA and debugging

Current mismatch versus branding:

- current global palette is warm/light and reads more like an editorial ops dashboard
- branding calls for a dark control-room look
- page styling still feels "functional prototype" rather than "Bitpunk operator cockpit"

Therefore the next frontend phase should not just tweak layout. It should realign the visual system with brand direction while preserving the current data structure and route structure.

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

## 6. Page Style Summary

### 6.1 Overview

Role:

- command-center snapshot

Should feel like:

- first-look operating console

Needs:

- concise KPI cards
- recent activity
- immediate path into pipelines and agent runs

Design note:

- cards should feel terminal-grade and sharp, not "friendly analytics tiles"

### 6.2 Pipelines

Role:

- scan-first market monitor

Should feel like:

- dense operational list with quick status reading

Needs:

- strong status chips
- row readability
- fast navigation into `Market Detail`

Design note:

- prioritize scan speed over decorative charting

### 6.3 Agent Runs

Role:

- planner diagnostics console

Should feel like:

- incident/debug screen for Hermes outputs

Needs:

- failed vs successful separation
- live vs replay distinction
- clear prompt/model/skill visibility
- obvious execution-eligibility signal
- direct jump into related `Market Detail`

Design note:

- surface abnormal runs first
- make metadata readable without drowning the page in raw JSON

### 6.4 Market Detail

Role:

- single-market plan lifecycle workspace

Should feel like:

- one market, one chain of reasoning, one execution trace

Needs:

- current state summary
- plan summary
- risk/execution/fill/position trace
- revision/review/lesson candidate follow-up
- raw trace section as fallback

Design note:

- this page is the most important page in the MVP
- organize it like a lifecycle narrative, not a dump of records

## 7. Page Implementation Priorities

The frontend should now progress in this order:

1. visual system realignment with Bitpunk branding
2. `Agent Runs` refinement
3. `Market Detail` refinement
4. `Overview` and `Pipelines` alignment into the same system
5. manual QA and polish

## 8. Repo Boundary

Frontend work should stay inside:

```txt
apps/web/app/**
apps/web/src/**
```

Preferred structure direction:

```txt
apps/web/
  app/
  src/
    components/
      overview/
      pipelines/
      agent-runs/
      market-detail/
      shared/
    dashboard/
      load-dashboard-data.ts
      formatters/
      view-models/
```

Rules:

- keep route structure stable
- keep API contracts stable
- extract presentational components instead of rewriting the app shell first
- use CSS variables for the Bitpunk visual system

## 9. Frontend Do / Do Not

Do:

- build an operator-first interface
- use brand colors with discipline
- emphasize state, hierarchy, and traceability
- keep raw debug access available
- make the most important next action or state obvious

Do not:

- turn the app into a generic SaaS dashboard
- overuse neon effects
- treat replay and live runs as the same thing visually
- invent missing backend concepts
- bury failures or risk events in secondary UI

## 10. Immediate Next Design Tasks

1. replace the current warm/light palette with a dark Bitpunk system
2. align typography with Sora + IBM Plex Mono direction
3. refactor `Agent Runs` into a stronger diagnostics layout
4. refactor `Market Detail` into a cleaner lifecycle layout
5. then unify `Overview` and `Pipelines` under the same visual language
