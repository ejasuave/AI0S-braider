#!/usr/bin/env bash
set -euo pipefail

# Set Vercel NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY to the pk_test_ value from .env.staging
# and trigger a production redeploy. Requires a Vercel token with project access.
#
# Usage:
#   VERCEL_TOKEN=… VERCEL_PROJECT_ID=… VERCEL_ORG_ID=… \
#     bash scripts/ops/set-vercel-stripe-test.sh
#
# Optional: VERCEL_PROJECT_NAME if IDs unknown (will list / resolve via API).

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/.env.staging}"

if [[ -z "${VERCEL_TOKEN:-}" ]]; then
  echo "Set VERCEL_TOKEN (Vercel → Settings → Tokens)." >&2
  echo "Then re-run this script, or set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_… in the Vercel UI and Redeploy." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE" >&2
  exit 1
fi

pk="$(
  python3 - "$ENV_FILE" <<'PY'
from pathlib import Path
import sys
for line in Path(sys.argv[1]).read_text().splitlines():
    if line.startswith("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="):
        v = line.split("=", 1)[1].strip().strip('"').strip("'")
        if not v.startswith("pk_test_"):
            raise SystemExit(f"Expected pk_test_ in {sys.argv[1]}, got mode={v[:8]}")
        print(v)
        raise SystemExit(0)
raise SystemExit("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY not found")
PY
)"

echo "Using publishable key fingerprint: ${pk:0:12}…${pk: -4}"

API="https://api.vercel.com"
AUTH=(-H "Authorization: Bearer ${VERCEL_TOKEN}" -H "Content-Type: application/json")

if [[ -z "${VERCEL_PROJECT_ID:-}" ]]; then
  echo "VERCEL_PROJECT_ID not set — listing projects (first match containing 'braider' or 'web')…"
  projects="$(curl -sf "${AUTH[@]}" "$API/v9/projects?limit=20")"
  VERCEL_PROJECT_ID="$(
    printf '%s' "$projects" | python3 -c '
import json,sys
d=json.load(sys.stdin)
cands=[p for p in d.get("projects",[]) if "braider" in p.get("name","").lower() or "web" in p.get("name","").lower()]
print(cands[0]["id"] if cands else "")
'
  )"
  if [[ -z "$VERCEL_PROJECT_ID" ]]; then
    echo "Could not resolve VERCEL_PROJECT_ID. Set it explicitly." >&2
    exit 1
  fi
  echo "Resolved VERCEL_PROJECT_ID=$VERCEL_PROJECT_ID"
fi

TEAM_QS=""
if [[ -n "${VERCEL_ORG_ID:-}" ]]; then
  TEAM_QS="?teamId=${VERCEL_ORG_ID}"
fi

# Upsert env for production + preview
body="$(
  PK="$pk" python3 - <<'PY'
import json, os
print(json.dumps({
  "key": "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "value": os.environ["PK"],
  "type": "plain",
  "target": ["production", "preview", "development"],
}))
PY
)"

# Remove existing (ignore 404) then create
existing="$(curl -sf "${AUTH[@]}" "$API/v9/projects/${VERCEL_PROJECT_ID}/env${TEAM_QS}" || true)"
env_id="$(
  printf '%s' "$existing" | python3 -c '
import json,sys
try:
  d=json.load(sys.stdin)
except Exception:
  print(""); raise SystemExit
for e in d.get("envs", d if isinstance(d, list) else []):
  if e.get("key")=="NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY":
    print(e.get("id","")); break
' 2>/dev/null || true
)"

if [[ -n "$env_id" ]]; then
  curl -sf -X DELETE "${AUTH[@]}" \
    "$API/v9/projects/${VERCEL_PROJECT_ID}/env/${env_id}${TEAM_QS}" >/dev/null || true
  echo "Removed previous NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
fi

curl -sf -X POST "${AUTH[@]}" \
  "$API/v10/projects/${VERCEL_PROJECT_ID}/env${TEAM_QS}" \
  -d "$body" >/dev/null

echo "Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_… on Vercel project"

# Trigger redeploy of latest production deployment
deploy_id="$(
  curl -sf "${AUTH[@]}" "$API/v6/deployments?projectId=${VERCEL_PROJECT_ID}&limit=1&target=production${TEAM_QS:+&teamId=${VERCEL_ORG_ID}}" \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["deployments"][0]["uid"] if d.get("deployments") else "")'
)"

if [[ -z "$deploy_id" ]]; then
  echo "Env updated but no production deployment found to redeploy. Trigger Redeploy in the Vercel UI." >&2
  exit 0
fi

curl -sf -X POST "${AUTH[@]}" \
  "$API/v13/deployments/${deploy_id}/redeploy${TEAM_QS}" \
  -d '{"name":"stripe-test-mode-align"}' >/dev/null || {
  echo "Redeploy API call failed — open Vercel → Deployments → Redeploy manually." >&2
  exit 0
}

echo "Redeploy triggered. Wait for Ready, then run:"
echo "  WEB_URL=https://ai-0-s-braider-web.vercel.app API_URL=https://project-braids-api-staging.fly.dev pnpm ops:check-stripe-staging"
