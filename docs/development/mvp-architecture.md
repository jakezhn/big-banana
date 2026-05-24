# MVP Architecture: Agent-First Phase

> This is the active architecture document for the new MVP phase. The previous workflow-first design is archived at `archived/mvp-architecture-workflow-first.md`.

## 1. Current State

The project has a working paper trading backbone:

```text
TradingView webhook
  -> canonical market state
  -> OpenAI/Vercel AI Gateway trade plan
  -> deterministic risk
  -> execution intent
  -> paper order
  -> reconcile
  -> dashboard read models
```

The current implementation already proves that an LLM planner can produce a frozen `trade_plan` and pass through the deterministic risk and paper execution chain.

The next MVP phase is not a restart. It is a refactor from:

```text
workflow-driven AI planner
```

to:

```text
agent-first reasoning inside deterministic workflow harnesses
```

## 2. Design Principle

The system should use Hermes/LLM reasoning where interpretation is valuable, while keeping hard facts and permissions outside the model.

```text
Supabase stores facts.
Workflow controls lifecycle.
Hermes interprets, plans, revises, and reviews.
Deterministic guardrails decide execution permission.
Dashboard exposes the trace.
```

Hermes must not be the source of truth for:

- webhook deduplication
- market state facts
- open position truth
- order status truth
- risk limits
- execution permission

Hermes may produce:

- market analysis
- signal analysis
- trade plans
- plan revisions
- reasoning-level risk review
- post-plan reviews
- memory lesson candidates

For the current MVP, Hermes reasons on one timeframe at a time. Different timeframes for the same ticker may coexist as independent planning tracks, but Hermes does not yet perform explicit HTF/LTF/MTF reasoning.

## 3. Active Applications

### `apps/web`

Frontend only:

- Overview
- Pipeline Monitor
- Market Detail
- Agent Runs
- later: plan review and replay UI

### `apps/api`

HTTP and webhook harness:

- TradingView intake
- Supabase health probe
- dashboard read APIs
- intervention endpoints
- paper reconcile endpoints

In the agent-first phase, API routes should remain thin. They should load facts, validate requests, call workflow/agent services, and return structured state.

### Future `apps/hermes`

Recommended next application boundary when agent work moves out of HTTP routes:

- Dockerized Hermes worker service
- Supabase-backed job polling
- async planner workflow
- replay workflow
- post-plan review workflow
- memory curation workflow
- future exchange/reconcile worker hooks

This should remain in the same repo because it shares contracts, domain logic, migrations, and dashboard read models.

## 4. Shared Packages

### `packages/contracts`

Owns machine-readable schemas and validators.

Current contracts remain valid:

- `webhook-payload-v12`
- `trade-plan`
- `risk-verdict`
- `execution-intent`

Agent-first phase should add new contracts only when the output becomes persisted or used across module boundaries:

- `planner-context-v2`
- `market-analysis`
- `signal-analysis`
- `plan-review`
- `plan-revision`
- `memory-lesson-candidate`

### `packages/domain`

Owns deterministic business logic:

- context builders
- plan versioning
- risk evaluation
- execution intent construction
- order and position state transitions
- intervention semantics

The agent-first phase should keep deterministic guardrails here. LLM code should not replace state machines or hard risk checks.

### `packages/db`

Owns Postgres repositories and migrations.

Supabase remains the fact store. Agent memory may later use `pgvector`, but raw market facts, positions, orders, fills, and plans stay in relational tables.

## 5. Data Model Direction

Already implemented:

- `webhook_events`
- `market_states_current`
- `market_states_history`
- `trade_plan_versions`
- `plan_transitions`
- `risk_verdicts`
- `execution_intents`
- `orders`
- `fills`
- `positions_current`
- `positions_history`
- `agent_runs`

Next MVP phase additions:

- expanded `agent_runs` metadata: prompt version, model provider, raw prompt/output capture policy, token usage when available
- `agent_jobs`: Supabase-backed durable queue for Hermes jobs
- `agent_locks` or DB advisory-lock backed lock helpers for symbol/plan/account/execution concurrency
- planner context v2 read model: `recentSnapshots`, `windowSummary`, open position, open orders, active plan, and `latestSnapshots` as hidden MTF reference only
- plan review records
- plan revision suggestions
- post-plan review records
- memory lesson candidates

Do not add long-term vector memory before post-plan review quality is measurable.

## 6. Agent Roles

The MVP should not physically split into many agents immediately. Start with one Hermes planner runtime and explicit skills.

Logical roles:

- Market Analyst: interpret broader market and the current single-timeframe context
- Signal Analyst: evaluate signal quality and contradictions
- Trade Planner: produce frozen `trade_plan`
- Plan Revision Agent: suggest updates to active plans as context changes
- Risk Reviewer: provide reasoning-level risk flags
- Post-Plan Review Agent: summarize outcome and lesson candidates
- Memory Curator: decide which lesson candidates are scoped enough to store

Only Trade Planner is currently implemented.

In the current MVP, `BTCUSDT:1H`, `BTCUSDT:4H`, `BTCUSDT:1D`, and `BTCUSDT:1W` are separate `marketKey` tracks. They may all exist at the same time, but each plan is generated from its own timeframe context.

## 7. Guardrail Boundary

Hermes can suggest a plan or revision. It cannot approve itself for execution.

Execution still requires:

1. frozen schema validation
2. deterministic risk verdict
3. execution intent validation
4. order state machine
5. reconcile/fill/position truth updates

This remains true even when Hermes later suggests stop movement, partial reduction, or plan invalidation.

## 8. Deployment

MVP deployment should move toward:

- Vercel: `apps/web`
- Vercel: `apps/api`
- Supabase: Postgres, Storage, SDK health
- Vercel AI Gateway: OpenAI-compatible planner runtime
- VPS / Docker Compose: Hermes workers and controlled long-running jobs

The agent-first refactor does not require a separate repo.

Inngest is optional, not the primary path, if a VPS is available. It remains a reasonable fallback when the project wants managed retries and hosted durable workflows without running worker infrastructure.

### 8.1 Runtime split

```text
Vercel apps/web
  dashboard frontend

Vercel apps/api
  webhook receiver
  dashboard read APIs
  operator APIs
  agent job enqueue APIs

Supabase
  facts
  read models
  agent_jobs
  agent_runs
  later: pgvector memory

VPS apps/hermes
  job polling
  lock management
  Hermes invocation
  schema validation
  result persistence
  replay/review/memory jobs
```

The first runtime should be intentionally small:

- one `apps/hermes` Docker service
- one planning worker loop
- one durable job queue in Supabase/Postgres

Only after the queue, lock, retry, and replay model is validated should the project increase worker concurrency or split Hermes into multiple deployed services.

### 8.2 Multi-Hermes shape

Hermes should not become one global trading brain. Use scoped roles and route jobs by market and task:

- Global Market Hermes: risk-on/risk-off and cross-market summaries
- Crypto Hermes: BTC/ETH/altcoin planning, revision, review, scoped crypto lessons
- US Equity Hermes: sector/index/earnings-aware equity plans
- CN Equity Hermes: policy/theme/liquidity-aware CN/HK plans
- Commodity Hermes: macro/commodity-driver plans

MVP can run these as logical roles in one Docker service first. Physical process splitting can wait until throughput or isolation requires it.

Important distinction:

- logical multi-Hermes: different role prompts, retrieval scopes, and job routing rules
- physical multi-worker/multi-container: multiple polling loops or Docker replicas

The MVP should implement logical role separation first and keep physical deployment simple.

This role split is by market, not by timeframe. Timeframe remains part of the `marketKey` and queue/lock identity, not a separate Hermes role dimension in the current MVP.

### 8.3 Queue and locks

Use Supabase/Postgres as the initial queue:

- `agent_jobs` for durable work
- `idempotency_key` for duplicate prevention
- `FOR UPDATE SKIP LOCKED` or advisory locks for worker claiming
- retry and timeout fields for recovery

Correctness should rely on durable polling and claiming, not on realtime delivery. The worker should continue to function if websocket delivery is delayed or unavailable.

Supabase Realtime and Database Webhooks can still be useful, but only as secondary mechanisms:

- Realtime Broadcast or Postgres Changes: notify the dashboard that fresh data is available
- Database Webhooks or lightweight realtime wake-ups: optionally reduce worker polling latency

Neither should be the only way Hermes learns about a new job.

Concurrency rules:

- analysis jobs: high concurrency
- planning jobs: `marketKey`-level lock
- revision jobs: plan-level lock
- risk review: account-level lock
- execution: account-level lock first, account+symbol-level later if needed

Planning and replay should treat each timeframe as independent:

- `BTCUSDT:1H` planning job and `BTCUSDT:4H` planning job may both run
- they should not be coalesced into one MTF bundle in the current MVP
- risk and execution still need shared account/symbol awareness so the account cannot overexpose itself through separate timeframe plans

Risk and execution do not need to be agents. They should remain deterministic skills/services that workers call after Hermes proposes a plan or revision.

### 8.4 Dashboard freshness

Dashboard freshness should prefer a two-step model:

1. Supabase emits a lightweight realtime signal
2. frontend reloads authoritative data from API/read models

This keeps facts in relational tables and avoids coupling UI correctness to raw database change streams.

Recommended order:

- MVP acceptable: periodic refresh or manual reload
- Better MVP: Supabase Realtime Broadcast signals, then API re-fetch
- Acceptable early alternative: Supabase Postgres Changes subscriptions on a few read-model tables

Broadcast is a better long-term fit for "something changed, re-fetch now" than using raw table change feeds everywhere.

## 9. Current Architectural Gaps

The current repo supports the refactor direction, but these gaps must be closed:

- `apps/hermes` still only handles `replay_planner`; live `generate_plan` has not moved to the worker yet
- replay harness exists, but DB-backed batch replay and planner quality comparison loop are still missing
- no plan revision model exists
- no post-plan review or lesson candidate table exists
- the MVP still lacks an explicit "single-timeframe reasoning, multi-timeframe coexistence" rule across planner, queue, and revision flows
- `latestSnapshots` still needs to be treated as hidden reference context rather than active MTF reasoning input

## 10. Active Reference

The detailed staged refactor plan lives in:

- `mvp-agent-first-refactor.md`
