#!/usr/bin/env bash
set -euo pipefail

# Verify staging stays on Stripe *test* mode (API + optional web bundle).
#
# Usage:
#   API_URL=https://project-braids-api-staging.fly.dev \
#   WEB_URL=https://ai-0-s-braider-web.vercel.app \
#   OPS_TOKEN=... \
#   pnpm ops:check-stripe-staging
#
# Expects Fly `stripeMode: test` via ops-status (after API deploy with stripeMode field).
# Expects Vercel bundle to contain pk_test_ and not pk_live_ for NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.

API_URL="${API_URL:?Set API_URL}"
WEB_URL="${WEB_URL:-}"
OPS_TOKEN="${OPS_TOKEN:-}"
FLY_APP="${FLY_APP:-project-braids-api-staging}"

pass=0
fail=0

ok() { echo "OK   $1"; pass=$((pass + 1)); }
bad() { echo "FAIL $1"; fail=$((fail + 1)); }

echo "==> Stripe staging mode check"
echo ""

# --- Fly process env (authoritative for PaymentIntents) ---
if command -v fly >/dev/null 2>&1; then
  fly_mode="$(
    fly ssh console -a "$FLY_APP" -C \
      "node -e \"const k=process.env.STRIPE_SECRET_KEY||'';console.log(k.startsWith('sk_test_')?'test':k.startsWith('sk_live_')?'live':k?'other':'mock')\"" \
      2>/dev/null | tail -n 1 | tr -d '\r'
  )"
  if [[ "$fly_mode" == "test" ]]; then
    ok "Fly STRIPE_SECRET_KEY mode=test ($FLY_APP)"
  else
    bad "Fly STRIPE_SECRET_KEY mode=$fly_mode (expected test) on $FLY_APP"
  fi
else
  echo "SKIP Fly ssh (fly CLI not found)"
fi

# --- ops-status stripeMode (if OPS_TOKEN + deployed field) ---
if [[ -n "$OPS_TOKEN" ]]; then
  body="$(curl -sf -H "Authorization: Bearer ${OPS_TOKEN}" "$API_URL/api/v1/system/ops-status" || true)"
  if [[ -z "$body" ]]; then
    bad "GET ops-status failed"
  else
    mode="$(printf '%s' "$body" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("stripeMode","missing"))' 2>/dev/null || echo missing)"
    if [[ "$mode" == "test" ]]; then
      ok "ops-status stripeMode=test"
    elif [[ "$mode" == "missing" ]]; then
      echo "SKIP ops-status stripeMode (API not yet redeployed with field — use Fly check above)"
    else
      bad "ops-status stripeMode=$mode (expected test)"
    fi
  fi
else
  echo "SKIP ops-status (set OPS_TOKEN to include)"
fi

# --- Vercel / web publishable key ---
if [[ -n "$WEB_URL" ]]; then
  html="$(curl -sf "$WEB_URL/" || true)"
  if [[ -z "$html" ]]; then
    bad "GET $WEB_URL/ failed"
  else
    tmp_html="$(mktemp)"
    tmp_js="$(mktemp)"
    printf '%s' "$html" >"$tmp_html"
    chunk="$(python3 - "$tmp_html" <<'PY'
import re, sys
html = open(sys.argv[1]).read()
m = re.findall(r'/_next/static/chunks/app/layout-[^"]+\.js', html)
print(m[0] if m else "")
PY
)"
    rm -f "$tmp_html"
    if [[ -z "$chunk" ]]; then
      bad "Could not locate app layout chunk on $WEB_URL"
    else
      curl -sf "${WEB_URL}${chunk}" >"$tmp_js" || true
      modes="$(python3 - "$tmp_js" <<'PY'
import re, sys
body = open(sys.argv[1]).read()
has_test = bool(re.search(r'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:\s*"pk_test_', body))
has_live = bool(re.search(r'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:\s*"pk_live_', body))
print("test" if has_test else "no-test", "live" if has_live else "no-live")
PY
)"
      rm -f "$tmp_js"
      has_test="$(echo "$modes" | awk '{print $1}')"
      has_live="$(echo "$modes" | awk '{print $2}')"
      if [[ "$has_test" == "test" && "$has_live" == "no-live" ]]; then
        ok "Web bundle NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_"
      elif [[ "$has_live" == "live" ]]; then
        bad "Web bundle has pk_live_ — set Vercel NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_… (from .env.staging) and Redeploy"
      else
        bad "Web bundle: could not find NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_test_/pk_live_)"
      fi
    fi
  fi
else
  echo "SKIP web bundle (set WEB_URL to include)"
fi

echo ""
echo "Passed: $pass  Failed: $fail"
if [[ "$fail" -gt 0 ]]; then
  echo ""
  echo "Fix (staging = test mode only):"
  echo "  1. Vercel → Project → Settings → Environment Variables"
  echo "     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_test_… (copy from repo .env.staging — not pk_live_)"
  echo "  2. Redeploy the web app"
  echo "  3. Fly: STRIPE_SECRET_KEY=sk_test_… and webhook secret from Stripe Test mode endpoint"
  echo "  4. Re-run: WEB_URL=... API_URL=... OPS_TOKEN=... pnpm ops:check-stripe-staging"
  exit 1
fi
