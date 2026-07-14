#!/usr/bin/env bash
set -euo pipefail

# Post-deploy smoke test for staging / production API hosts.
#
# Usage:
#   API_URL=https://project-braids-api-staging.fly.dev OPS_TOKEN=secret pnpm ops:smoke-staging

API_URL="${API_URL:?Set API_URL (e.g. https://project-braids-api-staging.fly.dev)}"
OPS_TOKEN="${OPS_TOKEN:-}"

AUTH=()
if [[ -n "$OPS_TOKEN" ]]; then
  AUTH=(-H "Authorization: Bearer ${OPS_TOKEN}")
fi

pass=0
fail=0

check() {
  local label="$1"
  local url="$2"
  local expect="${3:-200}"
  local code
  code="$(curl -sf -o /dev/null -w '%{http_code}' "${AUTH[@]}" "$url" 2>/dev/null || echo "000")"
  if [[ "$code" == "$expect" ]]; then
    echo "OK   $label ($code)"
    pass=$((pass + 1))
  else
    echo "FAIL $label (expected $expect, got $code) — $url"
    fail=$((fail + 1))
  fi
}

echo "==> Smoke test — $API_URL"
echo ""

check "GET /health" "$API_URL/health"
check "GET /health/db" "$API_URL/health/db"
check "GET /api/v1/ping" "$API_URL/api/v1/ping"
check "GET /api/v1/system/ops-status" "$API_URL/api/v1/system/ops-status"

echo ""
echo "Passed: $pass  Failed: $fail"
if [[ "$fail" -gt 0 ]]; then
  exit 1
fi

echo ""
echo "Optional manual checks:"
echo "  - Stripe webhook: Dashboard → recent delivery to $API_URL/api/v1/webhooks/stripe"
echo "  - Twilio SMS: POST to $API_URL/api/v1/webhooks/twilio/sms"
echo "  - Web app loads and calls $API_URL from browser (CORS)"
