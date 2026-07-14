#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET="$ROOT/.env.staging"
TEMPLATE="$ROOT/.env.staging.example"

if [[ -f "$TARGET" ]]; then
  echo "Already exists: .env.staging"
  echo "Delete it first if you want a fresh scaffold."
  exit 1
fi

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Missing template: .env.staging.example"
  exit 1
fi

cp "$TEMPLATE" "$TARGET"

JWT_SECRET="$(openssl rand -hex 32)"
OPS_TOKEN="$(openssl rand -hex 24)"
WEBHOOK_SECRET="$(openssl rand -hex 24)"

# Portable in-place replace (Linux + macOS)
replace() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$TARGET"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$TARGET"
  else
    printf '\n%s=%s\n' "$key" "$value" >>"$TARGET"
  fi
}

replace "JWT_SECRET" "$JWT_SECRET"
replace "OPS_BEARER_TOKEN" "$OPS_TOKEN"
replace "GOOGLE_CALENDAR_WEBHOOK_SECRET" "$WEBHOOK_SECRET"

rm -f "${TARGET}.bak"

echo "Created .env.staging with generated secrets."
echo ""
echo "Next — edit .env.staging and set:"
echo "  DATABASE_URL          (Supabase staging)"
echo "  REDIS_URL             (Upstash)"
echo "  CORS_ORIGIN           (Vercel web URL)"
echo "  WEB_APP_URL           (same as CORS_ORIGIN)"
echo "  API_PUBLIC_URL        (Fly API URL)"
echo "  STRIPE_*              (Stripe test mode)"
echo "  TWILIO_*              (Twilio number)"
echo "  ANTHROPIC_API_KEY"
echo "  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET"
echo ""
echo "Then: export vars and run  pnpm ops:migrate-deploy"
echo "Guide: docs/STAGING_SETUP.md"
