# Phase 1 Paper Smoke Runbook

This runbook is the single shortest path for pre-live integration.
It uses the current local pipeline only:

- TradingView webhook route
- deterministic planner
- deterministic risk engine
- manual approval endpoint
- paper submit stub
- paper reconcile stub

## 1. Prerequisites

- PostgreSQL is reachable from `DATABASE_URL`
- `.env.local` or equivalent app env is populated
- all migrations are applied in order

Environment baseline:

```bash
cp .env.example apps/web/.env.local
```

Manual approval is enabled by default:

```bash
PIPELINE_REQUIRE_HUMAN_APPROVAL=true
```

## 2. Apply migrations

Run in order:

```bash
psql "$DATABASE_URL" -f packages/db/migrations/0001_webhook_events.sql
psql "$DATABASE_URL" -f packages/db/migrations/0002_market_states.sql
psql "$DATABASE_URL" -f packages/db/migrations/0003_trade_plans.sql
psql "$DATABASE_URL" -f packages/db/migrations/0004_risk_verdicts.sql
psql "$DATABASE_URL" -f packages/db/migrations/0005_execution_intents.sql
psql "$DATABASE_URL" -f packages/db/migrations/0006_orders.sql
```

## 3. Start the app

```bash
pnpm --filter @big-banana/web dev
```

Default base URL:

```text
http://127.0.0.1:3000
```

## 4. Run the paper smoke flow

Default flow:

```bash
pnpm smoke:paper
```

This performs:

1. snapshot webhook
2. signal webhook
3. read pipeline
4. manual approve
5. submit paper order
6. reconcile to `filled`
7. read final pipeline

Optional flags:

```bash
BASE_URL=http://127.0.0.1:3000 pnpm smoke:paper
MARKET_KEY=BINANCE:BTCUSDT:240 pnpm smoke:paper
RECONCILE_OUTCOME=canceled pnpm smoke:paper
SKIP_APPROVE=1 pnpm smoke:paper
```

Use `SKIP_APPROVE=1` only when:

- `PIPELINE_REQUIRE_HUMAN_APPROVAL=false`
- or the current market already has `pipeline_status = intent_ready`

## 5. Expected status progression

Normal manual-review path:

1. `normalized`
2. `risk_review_required`
3. `intent_ready`
4. `order_submitted`
5. `order_terminal`

Auto-approval path:

1. `normalized`
2. `intent_ready`
3. `order_submitted`
4. `order_terminal`

## 6. Read API checks

Inspect current chain state:

```bash
curl --silent \
  "http://127.0.0.1:3000/api/market-pipeline?market_key=BINANCE:BTCUSDT:240"
```

Key fields to inspect:

- `pipeline_status`
- `trade_plan_version`
- `risk_verdict`
- `execution_intent`
- `latest_order`

## 7. Manual step-by-step alternative

If you do not want to use the smoke script:

```bash
curl -X POST http://127.0.0.1:3000/api/webhooks/tradingview \
  -H 'content-type: application/json' \
  --data @packages/contracts/test/fixtures/snapshot.valid.json
```

```bash
curl -X POST http://127.0.0.1:3000/api/webhooks/tradingview \
  -H 'content-type: application/json' \
  --data @packages/contracts/test/fixtures/signal.valid.json
```

```bash
curl -X POST \
  "http://127.0.0.1:3000/api/market-pipeline/approve?market_key=BINANCE:BTCUSDT:240"
```

```bash
curl -X POST \
  "http://127.0.0.1:3000/api/market-pipeline/submit?market_key=BINANCE:BTCUSDT:240"
```

```bash
curl -X POST \
  "http://127.0.0.1:3000/api/market-pipeline/reconcile?market_key=BINANCE:BTCUSDT:240&outcome=filled"
```

## 8. DB spot checks

Minimal spot checks:

```sql
select event_key, delivery_count, process_status
from webhook_events
order by received_at desc
limit 10;
```

```sql
select market_key, updated_at
from market_states_current
order by updated_at desc
limit 10;
```

```sql
select plan_id, version, market_key, created_at
from trade_plan_versions
order by created_at desc
limit 10;
```

```sql
select verdict, require_human_approval, created_at
from risk_verdicts
order by created_at desc
limit 10;
```

```sql
select idempotency_key, created_at
from execution_intents
order by created_at desc
limit 10;
```

```sql
select venue, client_order_id, status, submitted_at, terminal_at
from orders
order by submitted_at desc
limit 10;
```

## 9. Failure interpretation

- `risk_review_required`: signal path is healthy; approval step still required
- `risk_rejected`: planner path is healthy; deterministic risk blocked execution
- `intent_not_ready`: approval was skipped too early
- `already_submitted`: idempotent submit path is working
- `already_terminal`: reconcile path was repeated after closure

## 10. Scope boundary

This runbook intentionally does not cover:

- real TradingView hosted webhook delivery
- Bybit HTTP submit
- REST reconcile against a real venue
- fills
- positions
- portfolio state
