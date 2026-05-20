#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  DATABASE_URL='postgresql://...' pnpm db:migrate:remote

Requirements:
  - psql installed locally
  - DATABASE_URL points to a remote Supabase dev/staging project
  - use Direct connection or Session pooler on port 5432
  - do not use Transaction pooler on port 6543 for this project
EOF
  exit 0
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required but was not found in PATH" >&2
  exit 1
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

migrations=(
  "packages/db/migrations/0001_webhook_events.sql"
  "packages/db/migrations/0002_market_states.sql"
  "packages/db/migrations/0003_trade_plans.sql"
  "packages/db/migrations/0004_risk_verdicts.sql"
  "packages/db/migrations/0005_execution_intents.sql"
  "packages/db/migrations/0006_orders.sql"
  "packages/db/migrations/0007_security_and_index_tuning.sql"
)

for migration in "${migrations[@]}"; do
  echo
  echo "==> applying $migration"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/$migration"
done

echo
echo "Remote migrations applied successfully."
