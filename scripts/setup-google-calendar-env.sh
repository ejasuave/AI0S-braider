#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env"
WEBHOOK_SECRET="$(openssl rand -hex 24)"

if [[ ! -f "$ENV_FILE" ]]; then
  cp .env.example "$ENV_FILE"
  echo "Created .env from .env.example"
fi

set_env() {
  local key="$1"
  local value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '\n%s=%s\n' "$key" "$value" >>"$ENV_FILE"
  fi
}

set_env "API_PUBLIC_URL" "http://localhost:3001"

if ! grep -q '^GOOGLE_CALENDAR_WEBHOOK_SECRET=' "$ENV_FILE"; then
  set_env "GOOGLE_CALENDAR_WEBHOOK_SECRET" "$WEBHOOK_SECRET"
  echo "Set GOOGLE_CALENDAR_WEBHOOK_SECRET"
fi

echo ""
echo "Next: add Google OAuth credentials to .env (see docs/GOOGLE_CALENDAR_SETUP.md):"
echo "  GOOGLE_CLIENT_ID=....apps.googleusercontent.com"
echo "  GOOGLE_CLIENT_SECRET=GOCSPX-..."
echo "  NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same as GOOGLE_CLIENT_ID>"
echo ""
echo "Then run: bash scripts/check-google-calendar-env.sh"
