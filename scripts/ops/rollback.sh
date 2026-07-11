#!/usr/bin/env bash
set -euo pipefail

# Chapter 23.3 — Rollback helper (application layer).
# Database rollbacks are forward-only — see docs/MIGRATIONS.md.

cat <<'EOF'
Project Braids rollback procedure
================================

Application rollback (preferred — minutes):
1. Identify last known-good git tag or commit SHA.
2. Redeploy previous image/commit to API + worker + web.
   - Fly.io:  fly deploy --image <previous-image-ref> -a <app>
   - Vercel:  Redeploy previous production deployment from dashboard
3. Verify /health and /api/v1/system/ops-status
4. If AI misbehaving: AI_RECEPTIONIST_ENABLED=false (kill switch) BEFORE redeploy

Kill switch (fastest — no git rollback):
  fly secrets set AI_RECEPTIONIST_ENABLED=false -a <api-app>
  fly machines restart -a <api-app>

Database:
  - Never run prisma migrate reset in production.
  - Forward-fix with a new migration if schema deploy caused issues.
  - Restore from backup only for catastrophic data loss (test restore quarterly).

Post-incident:
  - Record timeline, root cause, and whether kill switch or rollback was used.
  - Re-run scripts/ops/kill-switch-drill.sh after recovery.

Full detail: docs/DEPLOYMENT.md
EOF
