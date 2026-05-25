#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_ENV_FILE="$ROOT_DIR/apps/api/.env.local"
HERMES_ENV_FILE="$ROOT_DIR/apps/hermes/.env.local"

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
  if [[ -f "$API_ENV_FILE" ]]; then
    set -a
    source "$API_ENV_FILE"
    set +a
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ -f "$HERMES_ENV_FILE" ]]; then
    set -a
    source "$HERMES_ENV_FILE"
    set +a
  fi
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required (or configure it in apps/api/.env.local or apps/hermes/.env.local)" >&2
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
  "packages/db/migrations/0008_fills_and_positions.sql"
  "packages/db/migrations/0009_agent_runs.sql"
  "packages/db/migrations/0010_agent_jobs_and_locks.sql"
  "packages/db/migrations/0011_agent_runs_metadata.sql"
  "packages/db/migrations/0012_plan_revision_suggestions.sql"
  "packages/db/migrations/0013_post_plan_reviews.sql"
  "packages/db/migrations/0014_memory_lesson_candidates.sql"
)

for migration in "${migrations[@]}"; do
  echo
  echo "==> applying $migration"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/$migration"
done

echo
echo "Remote migrations applied successfully."
