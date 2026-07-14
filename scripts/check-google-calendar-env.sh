#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env ]]; then
  echo "FAIL: No .env at repo root"
  exit 1
fi

read_env() {
  grep -E "^${1}=" .env 2>/dev/null | cut -d= -f2- | head -1 || true
}

GOOGLE_CLIENT_ID="$(read_env GOOGLE_CLIENT_ID)"
GOOGLE_CLIENT_SECRET="$(read_env GOOGLE_CLIENT_SECRET)"
NEXT_PUBLIC_GOOGLE_CLIENT_ID="$(read_env NEXT_PUBLIC_GOOGLE_CLIENT_ID)"
GOOGLE_CALENDAR_WEBHOOK_SECRET="$(read_env GOOGLE_CALENDAR_WEBHOOK_SECRET)"
API_PUBLIC_URL="$(read_env API_PUBLIC_URL)"

ok=0
fail=0

check() {
  local label="$1"
  local value="$2"
  if [[ -n "${value:-}" ]]; then
    echo "OK   $label"
    ok=$((ok + 1))
  else
    echo "MISS $label"
    fail=$((fail + 1))
  fi
}

check "GOOGLE_CLIENT_ID" "$GOOGLE_CLIENT_ID"
check "GOOGLE_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET"
check "NEXT_PUBLIC_GOOGLE_CLIENT_ID" "$NEXT_PUBLIC_GOOGLE_CLIENT_ID"

if [[ -n "$GOOGLE_CLIENT_ID" && -n "$NEXT_PUBLIC_GOOGLE_CLIENT_ID" && "$GOOGLE_CLIENT_ID" != "$NEXT_PUBLIC_GOOGLE_CLIENT_ID" ]]; then
  echo "WARN GOOGLE_CLIENT_ID and NEXT_PUBLIC_GOOGLE_CLIENT_ID should match"
fi

check "GOOGLE_CALENDAR_WEBHOOK_SECRET" "$GOOGLE_CALENDAR_WEBHOOK_SECRET"
check "API_PUBLIC_URL" "$API_PUBLIC_URL"

echo ""
echo "Passed: $ok  Missing: $fail"
if [[ "$fail" -gt 0 ]]; then
  echo "See docs/GOOGLE_CALENDAR_SETUP.md"
  exit 1
fi

echo "Env looks ready — restart pnpm dev and reconnect at /stylist/calendar"
