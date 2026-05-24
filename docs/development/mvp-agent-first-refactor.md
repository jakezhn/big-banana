# MVP Agent-First Refactor Plan

> This document defines the next MVP phase: refactor the working workflow planner into an agent-first system where workflow and Supabase act as the harness around Hermes reasoning.

## 1. Objective

The current system can already run:

```text
TradingView webhook
  -> market state
  -> LLM trade plan
  -> deterministic risk
  -> execution intent
  -> paper order
  -> reconcile
```

The new MVP phase should maximize agent capability without weakening reliability:

```text
deterministic workflow harness
  + Supabase fact store
  + Hermes reasoning, revision, review, and scoped learning
```

This is not a rewrite of the pipeline. It is a role shift:

- workflow keeps reliability, timing, idempotency, persistence, retries, and state transitions
- Supabase keeps facts, audit, replay data, and dashboard read models
- Hermes takes over interpretation, plan generation, plan revision, post-plan review, and lesson candidate extraction
- deterministic guardrails keep final risk and execution permission

## 2. Current Implementation Assessment

### Already Strong Enough

- `apps/api` has webhook, read APIs, interventions, reconcile, and Supabase health.
- `apps/web` has Overview, Pipeline Monitor, Market Detail, and Agent Runs pages.
- `packages/contracts` has frozen schemas for external payloads and core outputs.
- `packages/domain` has deterministic state transitions, risk checks, plan versioning, execution intent building, fills, and positions.
- `packages/db` has Postgres repositories and migrations through `agent_runs`.
- Vercel AI Gateway planner path has been validated through paper execution.

### Current Constraints

- The current MVP must explicitly stay single-timeframe in reasoning, even though one ticker may have multiple independent timeframe plans.
- `latestSnapshots` should remain only as hidden MTF reference, not active MTF reasoning input.
- The LLM path is still one-stage `plan.generate`.
- There are no persisted market analysis, signal analysis, plan revision, post-plan review, or lesson candidate records.
- Replay harness foundations now exist, but batch replay and planner quality comparison are still missing.
- `apps/hermes` exists and now handles both `replay_planner` and live `generate_plan`; the remaining gap is broader worker orchestration, dashboard QA, and planner quality iteration.

## 3. Target Architecture

```text
Data / Context Layer
  Supabase facts, snapshots, signals, plans, orders, fills, positions

Workflow / Orchestration Layer
  intake, dedupe, context loading, agent invocation, validation, persistence

Queue / Worker Layer
  job routing, polling, locks, retries, idempotency, timeout recovery

Agent Reasoning Layer
  Hermes analysis, planning, revision, review

Skill Layer
  structured capabilities with stable inputs and outputs

Memory / Learning Layer
  scoped lesson candidates first; vector memory later

Guardrail / Execution Layer
  deterministic risk, execution permission, order and position state machines
```

The first implementation should not physically split into many agents. It should introduce agent roles as structured operations and skills, then later move orchestration into `apps/hermes`.

For the current MVP, the target model is:

- single-timeframe reasoning
- multi-timeframe coexistence
- shared symbol/account risk awareness

That means `BTCUSDT:1H`, `BTCUSDT:4H`, `BTCUSDT:1D`, and `BTCUSDT:1W` may all maintain separate plans, but Hermes should reason from the current timeframe's signal and recent context only.

## 4. Affected Modules

### `packages/contracts`

Required changes:

- add `planner-context-v2` schema when context becomes a persisted/replayable object
- add schemas for agent outputs only when they cross module boundaries:
  - `market-analysis`
  - `signal-analysis`
  - `plan-revision`
  - `post-plan-review`
  - `memory-lesson-candidate`

Keep:

- `trade-plan`
- `risk-verdict`
- `execution-intent`
- `webhook-payload-v12`

The frozen `trade-plan` contract remains the execution-facing planner output for now.

### `packages/domain`

Required changes:

- upgrade `buildPlannerInput` to context v2:
  - `recentSnapshots`
  - `windowSummary`
  - `openOrders`
  - `openPosition`
  - `activePlan`
- keep `latestSnapshots`, but treat it as hidden reference context, not primary MTF reasoning context
- add deterministic derivation helpers for window summary
- add plan revision domain model
- add post-plan review domain model
- keep risk engine deterministic
- keep execution state transitions deterministic

Do not move LLM-specific API client code into domain.

### `packages/db`

Required changes:

- extend market state repository with recent history query by market key
- add `agent_jobs` queue repository
- add lock helpers for symbol, plan, account, and execution scopes
- expand `agent_runs` or add linked tables for:
  - prompt version
  - skill name
  - model provider
  - input/output capture policy
  - token usage when available
  - execution eligibility
- add migrations for:
  - `plan_revision_suggestions`
  - `post_plan_reviews`
  - `memory_lesson_candidates`

Later:

- add `pgvector` only after lesson candidates have review value

### `apps/api`

Required changes:

- keep webhook and HTTP harness thin
- enqueue agent jobs when work becomes long-running
- move planner-specific code from `apps/api/src/planner` toward a shared agent module as it grows
- add APIs for replay and agent review if dashboard needs them
- continue serving current dashboard read models

API should not become the durable workflow runtime.

### Future `apps/hermes`

Add when async orchestration starts:

- Dockerfile and worker entrypoint
- Supabase-backed job polling
- market/job router
- lock management
- retry and timeout handling
- `plan.generate`
- `plan.revise`
- `plan.review`
- `memory.curate`
- replay/evaluation jobs

This app should share `packages/contracts`, `packages/domain`, `packages/db`, and `packages/agent`.

Inngest remains an optional alternative if the project later prefers managed workflow orchestration over a VPS worker.

### `apps/web`

Required changes:

- enhance Agent Runs page with richer trace metadata
- add plan review / replay surfaces
- add Market Detail sections for recent context, revision, review, and lessons

Do not move business logic into the frontend.

## 5. Project Structure Assessment

Current structure is reasonable for the refactor:

```text
apps/web
apps/api
packages/contracts
packages/domain
packages/db
docs/development
```

It should not be split into separate repos.

Needed additions:

```text
apps/hermes
packages/agent
```

`apps/hermes` should own Docker runtime wiring, worker loops, job polling, and deployment config.

`packages/agent` should own reusable Hermes prompt builders, model adapters, skill implementations, and agent output validation helpers. This avoids keeping growing LLM-specific code under `apps/api/src/planner`.

Recommended future structure:

```text
apps/web              # frontend dashboard
apps/api              # HTTP harness and read APIs
apps/hermes           # Dockerized Hermes worker service
packages/contracts    # schemas and runtime validators
packages/domain       # deterministic trading domain
packages/db           # Supabase/Postgres repositories
packages/agent        # Hermes skills, prompt builders, model adapters
```

## 6. Staged Refactor Plan

### Stage 0: Documentation And Baseline Alignment

Status: current task.

Deliverables:

- archive workflow-first design docs
- make agent-first architecture the active MVP design
- update work tracker to treat this as a new MVP phase

### Stage 1: Context V2

Goal: give Hermes enough factual context before adding more agent roles.

Changes:

- add `recentSnapshots` to `PlannerInput`
- add `windowSummary`
- add market-state repository query:
  - `getRecentMarketStatesByMarketKey(marketKey, limit)`
- wire current position and open orders into planner input
- update OpenAI prompt to explain `recentSnapshots` and `windowSummary`
- expand tests around planner input

Validation:

- deterministic planner tests still pass
- OpenAI planner paper smoke still reaches at least `risk_approved`
- strong signal scenario can still reach `order_terminal`

### Stage 2: Supabase Job Queue And Worker Harness

Goal: establish durable orchestration without relying on Vercel API routes for long-running Hermes work.

Changes:

- add `agent_jobs`
- add job statuses:
  - `pending`
  - `running`
  - `completed`
  - `failed`
  - `cancelled`
  - `timeout`
- add fields:
  - `job_type`
  - `market`
  - `symbol`
  - `timeframe`
  - `priority`
  - `idempotency_key`
  - `payload_json`
  - `result_ref`
  - `locked_by`
  - `locked_until`
  - `attempt_count`
  - `max_attempts`
  - `run_after`
  - `last_error`
- add claim/retry helpers using `FOR UPDATE SKIP LOCKED` or advisory locks
- create `apps/hermes` with a minimal worker loop
- keep the first deployed runtime as one Docker service with one planning worker loop
- treat market-specific Hermes as logical roles inside that worker before physically splitting services
- treat realtime notifications as optional accelerators, not as the correctness path for job dispatch
- keep planning queue identity at `marketKey` granularity so different timeframes of one ticker can coexist without coalescing

Validation:

- duplicate enqueue is idempotent
- one worker claims one job once
- failed job can retry
- stale running job can recover
- the worker still finds jobs when realtime delivery is disabled

### Stage 3: Agent Run Evaluation Metadata

Goal: make planner quality observable.

Changes:

- add prompt version and skill name to agent run records
- store execution eligibility
- store model provider and model name separately
- store token usage when available
- store raw input/output according to a redaction policy
- add replay fixture set

Validation:

- dashboard Agent Runs can compare model/prompt versions
- replay can show action/state distribution and schema failures

### Stage 4: Planner Quality Loop

Goal: iterate the Hermes planner without touching execution.

Changes:

- add replay script/API
- add fixed multi-market fixture set
- record plan quality labels manually at first
- add prompt versioning
- add basic semantic checks:
  - `create/patch` should be execution-capable or degrade to `skip/watch`
  - neutral bias should not create open intents
  - entry zone and invalidation must be coherent

Validation:

- repeated replay shows fewer non-executable create plans
- risk rejection and execution-eligible rates are visible

### Stage 5: Multi-Hermes Router

Goal: route jobs to scoped Hermes roles without physically over-splitting too early.

Changes:

- add market/job router:
  - `global_scan` -> Global Market Hermes
  - `market=crypto` -> Crypto Hermes
  - `market=us_equity` -> US Equity Hermes
  - `market=cn_equity` -> CN Equity Hermes
  - `market=commodity` -> Commodity Hermes
- keep all roles in one Docker service initially
- add market scope to memory/replay metadata

Validation:

- crypto jobs do not retrieve equity-specific lessons
- role routing works while all roles still run in one `apps/hermes` deployment

Note:

- this stage is market routing, not timeframe routing
- the MVP still does not merge `1H` and `4H` jobs into one plan bundle

### Stage 6: Plan Revision Agent

Goal: turn plans into living objects.

Changes:

- add `plan_revision_suggestions`
- add Hermes operation `plan.revise`
- trigger revision on new snapshot/signal or manual request
- persist suggestion without automatically mutating facts
- workflow accepts or rejects deterministic-safe revisions

Validation:

- active plan can be suggested as keep/tighten/downgrade/invalidate
- dashboard shows revision timeline

### Stage 7: Post-Plan Review

Goal: create review data before memory.

Changes:

- add `post_plan_reviews`
- add Hermes operation `plan.review`
- collect plan, revisions, orders, fills, positions, and context timeline
- output scoped lesson candidates but do not write vector memory yet

Validation:

- completed paper trades can produce structured reviews
- review is visible from Market Detail

### Stage 8: Scoped Memory Candidates

Goal: add learning without memory pollution.

Changes:

- add `memory_lesson_candidates`
- add Memory Curator operation
- require metadata scope:
  - market
  - symbol
  - timeframe
  - regime
  - signal type
  - confidence
  - sample size
  - decay
- require manual acceptance before active retrieval

Validation:

- no raw facts are stored as memory
- lessons can be reviewed and rejected

### Stage 9: Worker Pool Split

Goal: split workers only after the single Hermes worker proves the job model.

Potential workers:

- analysis-worker
- planning-worker
- revision-worker
- review-worker
- memory-worker
- risk-worker
- execution-worker

Potential physical deployment after the single-worker baseline:

- one Docker service with several internal worker loops
- or several Docker replicas claiming from the same `agent_jobs` queue
- or separate services for planning/review/execution if throughput or isolation requires it

This split is a scaling step, not a starting requirement.

Concurrency policy:

- analysis: high concurrency
- planning: `marketKey` lock
- revision: plan lock
- risk: account lock
- execution: account lock, later `account + symbol` if needed

This preserves the intended boundary:

- separate timeframe plans may coexist
- risk still sees shared account exposure
- execution still sees shared account/symbol mutation

Risk and execution remain deterministic services, not agents.

## 7. What Not To Change Yet

Do not:

- replace deterministic risk with Hermes
- let Hermes mutate positions or orders directly
- add automatic vector memory writes
- introduce user tiers in this MVP phase
- replace Supabase as fact source
- split into multiple repos
- connect live exchange execution before agent quality and guardrails are measurable
- build Kubernetes-scale infrastructure before the Supabase queue and Docker worker model is validated

## 8. Migration Summary

The next real implementation step is Stage 1:

```text
PlannerInput v2 = current signal + current context + latestSnapshots + recentSnapshots + windowSummary + active plan + open position/orders
```

This is the highest-leverage change because it improves Hermes reasoning while preserving the current working workflow, risk, execution, and dashboard harness.

In the current MVP, `latestSnapshots` is not a prompt-level instruction to perform active HTF/LTF reasoning. It remains a hidden reference field that can be narrowed or ignored by the runtime while `recentSnapshots` and `windowSummary` stay authoritative for current-timeframe planning.

After Stage 1, the next infrastructure step is Stage 2:

```text
Vercel API enqueues agent_jobs
VPS apps/hermes polls and locks jobs
Hermes produces structured outputs
workers validate and persist results
dashboard reads Supabase facts
```

Realtime complements this flow but does not replace it:

```text
Supabase Realtime Broadcast/Postgres Changes
  -> tell the dashboard to re-fetch

Supabase Database Webhooks or wake signals
  -> optionally reduce worker polling delay
```

Polling plus durable claim remains the primary dispatch mechanism.
