#!/usr/bin/env bash
set -euo pipefail

# Chapter 23.3 — AI Receptionist kill-switch drill.
# Verifies ops-status reflects AI_RECEPTIONIST_ENABLED without a code redeploy.
#
# Usage:
#   API_URL=https://api-staging.example.com OPS_TOKEN=secret bash scripts/ops/kill-switch-drill.sh
#
# To activate kill switch on Fly.io (no git redeploy):
#   fly secrets set AI_RECEPTIONIST_ENABLED=false -a <api-app>
#   fly machines restart -a <api-app>
#
# To restore:
#   fly secrets set AI_RECEPTIONIST_ENABLED=true -a <api-app>
#   fly machines restart -a <api-app>

API_URL="${API_URL:-http://localhost:3001}"
OPS_TOKEN="${OPS_TOKEN:-}"

AUTH_HEADER=()
if [[ -n "$OPS_TOKEN" ]]; then
  AUTH_HEADER=(-H "Authorization: Bearer ${OPS_TOKEN}")
fi

echo "==> Kill-switch drill — ${API_URL}"
echo ""

echo "1. Current ops status:"
STATUS_JSON="$(curl -sf "${AUTH_HEADER[@]}" "${API_URL}/api/v1/system/ops-status")"
echo "$STATUS_JSON" | python3 -m json.tool 2>/dev/null || echo "$STATUS_JSON"

KILL_ACTIVE="$(echo "$STATUS_JSON" | python3 -c "import sys,json; d=json.load(sys.stdin); print('true' if d.get('data',{}).get('killSwitchActive') else 'false')" 2>/dev/null || echo "unknown")"

echo ""
if [[ "$KILL_ACTIVE" == "true" ]]; then
  echo "✓ Kill switch is ACTIVE — inbound SMS will escalate to stylist (AI disabled)."
else
  echo "○ Kill switch is OFF — AI receptionist is enabled."
fi

echo ""
echo "2. Drill checklist (do once per environment before production):"
echo "   [ ] Set AI_RECEPTIONIST_ENABLED=false on API host (env var / platform secret)"
echo "   [ ] Restart API processes (rolling restart — no git redeploy needed)"
echo "   [ ] Re-run this script — expect killSwitchActive: true"
echo "   [ ] Send test inbound SMS — conversation should escalate, not auto-reply"
echo "   [ ] Set AI_RECEPTIONIST_ENABLED=true and restart"
echo "   [ ] Re-run this script — expect killSwitchActive: false"
echo ""
echo "See docs/DEPLOYMENT.md § Kill switch for platform-specific commands."
