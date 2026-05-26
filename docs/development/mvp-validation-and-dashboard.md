# MVP Validation And Dashboard: Agent-First Phase

> This is the active validation document for the agent-first MVP phase. The previous workflow-first dashboard plan is archived at `archived/mvp-validation-and-dashboard-workflow-first.md`.

## 1. Current Validation Baseline

Already validated:

- remote Supabase health
- remote migrations through `0009_agent_runs`
- full paper pipeline
- minimal interventions: `flatten_position`, `cancel_pending_entry`
- Vercel AI Gateway planner path
- OpenAI-generated `trade_plan`
- `plan -> risk -> intent -> order -> reconcile`
- fills and current position after reconcile

Current validation has proven system connectivity. It has not yet proven strategy quality.

## 2. New MVP Validation Target

The agent-first phase should validate:

1. whether Hermes can generate better plans with richer context
2. whether plan quality can be measured across repeated replay cases
3. whether plan revisions improve active plan management
4. whether post-plan reviews produce useful, scoped lesson candidates
5. whether dashboard makes agent behavior debuggable

The next milestone is not simply "the model responds." It is:

```text
repeatable agent reasoning evaluation
```

## 3. Dashboard Responsibilities

Existing pages remain valid:

- Overview
- Pipeline Monitor
- Market Detail
- Agent Runs

The next frontend phase should be guided by `mvp-frontend-design.md`, not by separate v0-specific briefs. Frontend work now belongs directly inside the MVP implementation path.

Agent-first additions should make the dashboard answer:

- what context did Hermes see?
- what role or skill ran?
- what prompt/model version was used?
- was output schema-valid?
- was output execution-eligible?
- did deterministic risk change or reject it?
- what plan revision was suggested later?
- what did post-plan review conclude?

## 4. Required Dashboard Enhancements

### Agent Runs

Add fields or linked views for:

- prompt version
- model provider
- model name
- operation/skill name
- input context summary
- output summary
- validation status
- execution eligibility
- latency
- token usage when available
- linked plan/revision/review records

### Market Detail

Add:

- recent snapshot window
- window summary
- active plan timeline
- plan revisions
- post-plan review
- lesson candidates

### Replay View

Add a minimal internal page or API to replay fixed scenarios:

- selected fixtures
- selected model/runtime
- prompt version
- generated action/state distribution
- schema failures
- risk rejection rate
- execution-eligible rate

This can start as an API and script before becoming UI.

## 4.1 Frontend UI Phase

Frontend no longer needs a separate `frontend/` doc subtree or a v0-specific workflow.

The active frontend path is:

1. keep existing routes and read models
2. realign the visual system with Bitpunk branding
3. improve `Agent Runs` and `Market Detail` first
4. then align `Overview` and `Pipelines`
5. finish with manual QA and polish

For the current MVP, the frontend should optimize for:

- operator readability
- lifecycle traceability
- risk and failure visibility
- dense but structured diagnostics

### Realtime Refresh

Dashboard freshness should not depend on the worker sharing in-memory state with the frontend.

Preferred model:

1. Hermes worker writes facts and traces back to Supabase
2. Supabase emits a lightweight realtime signal
3. frontend re-fetches authoritative API/read-model data

Recommended order:

- simplest MVP: manual refresh or polling
- better MVP: Supabase Realtime Broadcast, then API re-fetch
- acceptable early fallback: Postgres Changes on a few read-model tables

Realtime should improve responsiveness, not become the source of truth.

## 5. Validation Order

Run validation in this order:

1. context v2 replay with deterministic planner
2. context v2 replay with Hermes/OpenAI planner
3. plan quality review over multi-market fixture set
4. full paper smoke with real planner
5. plan revision smoke
6. post-plan review smoke
7. memory lesson candidate review

Do not introduce automatic memory writes until post-plan review quality is reviewed manually.

## 6. Success Criteria

Agent-first MVP phase is successful when:

- planner context includes `recentSnapshots` and `windowSummary`
- `agent_runs` can explain prompt/model/skill/output quality
- replay can compare prompt/model versions on fixed scenarios
- Hermes can generate schema-valid and execution-aware plans consistently
- plan revision suggestions can be persisted without directly mutating facts
- post-plan reviews produce scoped lesson candidates
- dashboard can show why a plan was created, rejected, revised, or closed

## 7. Out Of Scope

Still out of scope for this MVP phase:

- paid user tiers
- public docs product
- fully autonomous memory writes
- Hermes as final execution permission source
- live exchange execution
- multi-agent distributed runtime unless the single `apps/hermes` Docker worker model has been validated first
