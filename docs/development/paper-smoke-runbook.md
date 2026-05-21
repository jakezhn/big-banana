# Paper Smoke Runbook For Remote Supabase

This runbook is now opinionated for one path only:

- local Next.js app
- remote Supabase dev or staging project
- deterministic planning/risk/execution pipeline
- paper order submit + reconcile stubs

Use this when you want a realistic hosted Postgres target without introducing Bybit yet.

## 1. Recommended topology

- app runtime: local `pnpm --filter @big-banana/web dev`
- database: remote Supabase project
- webhook source for smoke: local fixture replay via curl/script

Do not use your production Supabase project.
Create a dedicated dev or staging project only.

## 2. Create a remote Supabase project

In Supabase dashboard:

1. create a new project dedicated to smoke testing
2. wait for database provisioning to complete
3. open `Connect`
4. copy one of these connection strings:

Preferred:

- Direct connection, if your machine/network supports IPv6

Fallback:

- Session pooler on port `5432`, if you need IPv4 compatibility

Avoid for this repository:

- Transaction pooler on port `6543`

Reason:

- this project uses `postgres.js` with default prepared statements
- Supabase transaction pooler does not support prepared statements
- this smoke path also uses long-lived local app connections

Official references:

- Supabase connection strings: https://supabase.com/docs/reference/postgres/connection-strings
- Supabase + psql: https://supabase.com/docs/guides/database/psql
- Supabase + postgres.js: https://supabase.com/docs/guides/database/postgres-js

## 3. Choose the right DATABASE_URL

### Option A: Direct connection

Example shape:

```text
postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

Use this if your environment supports IPv6.

### Option B: Session pooler

Example shape:

```text
postgres://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres
```

Use this if you need IPv4.

### Do not use

Anything on port `6543` for this repository's current runtime path.

## 4. Local environment file

Create local env for the web app:

```bash
cp .env.example apps/web/.env.local
```

Then replace `DATABASE_URL` with your remote Supabase connection string.

Suggested baseline:

```bash
DATABASE_URL='your-supabase-connection-string'
NEXT_PUBLIC_SUPABASE_URL='https://your-project-ref.supabase.co'
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='your-publishable-key'
SUPABASE_SECRET_KEY='your-secret-key'
PIPELINE_MODE='full'
TRADING_ACCOUNT_ID=paper-tradingview
PIPELINE_ACCOUNT_EQUITY=20000
PIPELINE_MAX_TRADE_RISK_PCT=0.5
PIPELINE_MAX_NOTIONAL=100000
PIPELINE_MAX_LEVERAGE=3
```

## 5. Install psql locally

On macOS with Homebrew:

```bash
brew install libpq
echo 'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
psql --version
```

If you are on Intel Mac, replace `/opt/homebrew` with `/usr/local`.

## 6. Apply remote migrations

Export `DATABASE_URL` in the shell you will use for migrations:

```bash
export DATABASE_URL='your-supabase-connection-string'
```

Then run:

```bash
pnpm db:migrate:remote
```

This applies:

1. `0001_webhook_events.sql`
2. `0002_market_states.sql`
3. `0003_trade_plans.sql`
4. `0004_risk_verdicts.sql`
5. `0005_execution_intents.sql`
6. `0006_orders.sql`
7. `0007_security_and_index_tuning.sql`
8. `0008_fills_and_positions.sql`
9. `0009_agent_runs.sql`

If you want help text:

```bash
pnpm db:migrate:remote --help
```

## 7. Start the local API app

Run locally:

```bash
pnpm --filter @big-banana/api dev
```

Default base URL:

```text
http://127.0.0.1:3000
```

At this point:

- API routes run locally from `apps/api`
- all DB writes land in remote Supabase
- Supabase SDK clients can use Auth, Storage, and server-side admin probes
- `PIPELINE_MODE=full` means the system auto-generates intents and auto-submits paper orders

If you also want to preview the dashboard UI, start the frontend separately:

```bash
pnpm --filter @big-banana/web dev
```

Default frontend URL:

```text
http://127.0.0.1:3001
```

Use `PIPELINE_MODE=advisory` only when you want to stop at `plan + risk` and skip execution.

## 8. Verify Supabase SDK connectivity first

Before running the paper flow, probe the SDK path:

```bash
curl --silent "http://127.0.0.1:3000/api/supabase/health"
```

Expected minimum result:

- `framework = "nextjs"`
- `sdk.browser_client_configured = true`
- `sdk.server_client_configured = true`
- `sdk.admin_client_configured = true`
- `database.reachable = true`

Optional but useful:

- `storage.reachable = true`

If this step fails, fix SDK env vars before moving on to pipeline smoke.

## 9. Run the paper smoke flow

Default:

```bash
pnpm smoke:paper
```

Optional:

```bash
BASE_URL=http://127.0.0.1:3000 pnpm smoke:paper
MARKET_KEY=BINANCE:BTCUSDT:240 pnpm smoke:paper
RECONCILE_OUTCOME=canceled pnpm smoke:paper
```

If you just want help:

```bash
pnpm smoke:paper --help
```

## 10. What the smoke script does

The script performs:

1. `POST /api/webhooks/tradingview` with `snapshot.valid.json`
2. `POST /api/webhooks/tradingview` with `signal.valid.json`
3. `GET /api/market-pipeline`
4. `POST /api/market-pipeline/reconcile?outcome=filled`
5. `GET /api/market-pipeline`

## 11. Expected pipeline_status progression

1. `normalized`
2. `order_submitted`
3. `order_terminal`

## 12. Read API verification

Inspect current chain state:

```bash
curl --silent \
  "http://127.0.0.1:3000/api/market-pipeline?market_key=BINANCE:BTCUSDT:240"
```

Inspect:

- `pipeline_status`
- `trade_plan_version`
- `risk_verdict`
- `execution_intent`
- `latest_order`
- `latest_fill`
- `current_position`

## 13. Remote DB spot checks

Run these against the same remote Supabase project:

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

## 13. Failure interpretation

- `risk_rejected`: pipeline is healthy up to deterministic risk
- `intent_not_ready`: execution intent generation failed before order submission
- `already_submitted`: idempotent submit path is working
- `already_terminal`: reconcile was repeated after closure
- connection failure before step 1: local app is not running
- `psql` migration failure: usually wrong `DATABASE_URL`, SSL mismatch, or wrong Supabase connection mode

## 14. Scope boundary

This runbook still does not cover:

- real hosted TradingView webhook delivery
- Bybit HTTP submit
- real exchange reconcile
- fills
- positions
- portfolio state
