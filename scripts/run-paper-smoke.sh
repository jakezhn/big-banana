#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3000}"
MARKET_KEY="${MARKET_KEY:-BINANCE:BTCUSDT:240}"
RECONCILE_OUTCOME="${RECONCILE_OUTCOME:-filled}"
SKIP_APPROVE="${SKIP_APPROVE:-0}"

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
  SKIP_APPROVE=0|1
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

printf '\n[1/7] POST snapshot webhook\n'
post_json "$BASE_URL/api/webhooks/tradingview" "$SNAPSHOT_FIXTURE"

printf '\n[2/7] POST signal webhook\n'
post_json "$BASE_URL/api/webhooks/tradingview" "$SIGNAL_FIXTURE"

printf '\n[3/7] GET market pipeline\n'
get_json "$BASE_URL/api/market-pipeline?market_key=$MARKET_KEY"

if [[ "$SKIP_APPROVE" != "1" ]]; then
  printf '\n[4/7] POST manual approve\n'
  post_empty "$BASE_URL/api/market-pipeline/approve?market_key=$MARKET_KEY"
else
  printf '\n[4/7] SKIP manual approve\n'
fi

printf '\n[5/7] POST submit order\n'
post_empty "$BASE_URL/api/market-pipeline/submit?market_key=$MARKET_KEY"

printf '\n[6/7] POST reconcile order\n'
post_empty "$BASE_URL/api/market-pipeline/reconcile?market_key=$MARKET_KEY&outcome=$RECONCILE_OUTCOME"

printf '\n[7/7] GET final market pipeline\n'
get_json "$BASE_URL/api/market-pipeline?market_key=$MARKET_KEY"
