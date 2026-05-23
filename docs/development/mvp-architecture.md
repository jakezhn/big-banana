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

### Future `apps/agent`

Recommended next application boundary:

- Inngest functions
- async planner workflow
- replay workflow
- post-plan review workflow
- memory curation workflow

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
- planner context v2 read model: `recentSnapshots`, `windowSummary`, open position, open orders, active plan
- plan review records
- plan revision suggestions
- post-plan review records
- memory lesson candidates

Do not add long-term vector memory before post-plan review quality is measurable.

## 6. Agent Roles

The MVP should not physically split into many agents immediately. Start with one Hermes planner runtime and explicit skills.

Logical roles:

- Market Analyst: interpret broader market and multi-timeframe context
- Signal Analyst: evaluate signal quality and contradictions
- Trade Planner: produce frozen `trade_plan`
- Plan Revision Agent: suggest updates to active plans as context changes
- Risk Reviewer: provide reasoning-level risk flags
- Post-Plan Review Agent: summarize outcome and lesson candidates
- Memory Curator: decide which lesson candidates are scoped enough to store

Only Trade Planner is currently implemented.

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

MVP deployment remains:

- Vercel: `apps/web`
- Vercel: `apps/api`
- Supabase: Postgres, Storage, SDK health
- Vercel AI Gateway: OpenAI-compatible planner runtime
- Inngest: future async agent and replay workflows

The agent-first refactor does not require a separate repo.

## 9. Current Architectural Gaps

The current repo supports the refactor direction, but these gaps must be closed:

- `PlannerInput` lacks `recentSnapshots` and `windowSummary`
- `agent_runs` stores summaries but not enough evaluation metadata
- planner prompt and schemas are still a single-stage planner shape
- no replay/evaluation dataset exists
- no plan revision model exists
- no post-plan review or lesson candidate table exists
- no `apps/agent` runtime exists for durable async workflows

## 10. Active Reference

The detailed staged refactor plan lives in:

- `mvp-agent-first-refactor.md`

