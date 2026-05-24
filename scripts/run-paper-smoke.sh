#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
MARKET_KEY="${MARKET_KEY:-BINANCE:BTCUSDT:240}"
RECONCILE_OUTCOME="${RECONCILE_OUTCOME:-filled}"
WAIT_FOR_PLAN_TIMEOUT_SECONDS="${WAIT_FOR_PLAN_TIMEOUT_SECONDS:-15}"
WAIT_FOR_PLAN_INTERVAL_SECONDS="${WAIT_FOR_PLAN_INTERVAL_SECONDS:-1}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SNAPSHOT_FIXTURE="$ROOT_DIR/packages/contracts/test/fixtures/snapshot.valid.json"
SIGNAL_FIXTURE="$ROOT_DIR/packages/contracts/test/fixtures/signal.valid.json"

if [[ "${1:-}" == "--help" ]]; then
  cat <<'EOF'
Usage:
  pnpm smoke:paper

Environment overrides:
  BASE_URL=http://127.0.0.1:3000
  MARKET_KEY=BINANCE:BTCUSDT:240
  RECONCILE_OUTCOME=filled|canceled
  WAIT_FOR_PLAN_TIMEOUT_SECONDS=15
  WAIT_FOR_PLAN_INTERVAL_SECONDS=1
EOF
  exit 0
fi

post_json() {
  local url="$1"
  local body_file="$2"
  curl --silent --show-error \
    -X POST "$url" \
    -H 'content-type: application/json' \
    --data @"$body_file"
  printf '\n'
}

post_empty() {
  local url="$1"
  curl --silent --show-error -X POST "$url"
  printf '\n'
}

get_json() {
  local url="$1"
  curl --silent --show-error "$url"
  printf '\n'
}

wait_for_pipeline_plan() {
  local url="$1"
  local started_at
  started_at="$(date +%s)"

  while true; do
    local response
    response="$(curl --silent --show-error "$url")"

    if [[ "$response" != *'"trade_plan_version":null'* ]]; then
      printf '%s\n' "$response"
      return 0
    fi

    local now
    now="$(date +%s)"

    if (( now - started_at >= WAIT_FOR_PLAN_TIMEOUT_SECONDS )); then
      printf '%s\n' "$response"
      echo "Timed out waiting for Hermes worker to persist a trade plan." >&2
      return 1
    fi

    sleep "$WAIT_FOR_PLAN_INTERVAL_SECONDS"
  done
}

printf '\n[1/5] POST snapshot webhook\n'
post_json "$BASE_URL/api/webhooks/tradingview" "$SNAPSHOT_FIXTURE"

printf '\n[2/5] POST signal webhook\n'
post_json "$BASE_URL/api/webhooks/tradingview" "$SIGNAL_FIXTURE"

printf '\n[3/5] GET market pipeline\n'
wait_for_pipeline_plan "$BASE_URL/api/market-pipeline?market_key=$MARKET_KEY"

printf '\n[4/5] POST reconcile order\n'
post_empty "$BASE_URL/api/market-pipeline/reconcile?market_key=$MARKET_KEY&outcome=$RECONCILE_OUTCOME"

printf '\n[5/5] GET final market pipeline\n'
get_json "$BASE_URL/api/market-pipeline?market_key=$MARKET_KEY"
