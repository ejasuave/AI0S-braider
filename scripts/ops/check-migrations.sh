#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "==> Checking migration SQL for destructive patterns..."

ALLOWLIST_FILE="scripts/ops/migration-allowlist.txt"

is_allowlisted() {
  local candidate="$1"
  [[ -f "$ALLOWLIST_FILE" ]] || return 1
  grep -Fxq "$candidate" <(grep -Ev '^\s*(#|$)' "$ALLOWLIST_FILE")
}

DESTRUCTIVE_FOUND=0
while IFS= read -r -d '' file; do
  if grep -Eqi 'DROP TABLE|DROP COLUMN|ALTER COLUMN.*TYPE|RENAME TO' "$file"; then
    if is_allowlisted "$file"; then
      echo "NOTE: Reviewed destructive migration (allowlisted): $file"
      continue
    fi
    echo "WARNING: Potentially destructive SQL in $file"
    grep -En 'DROP TABLE|DROP COLUMN|ALTER COLUMN|RENAME TO' "$file" || true
    DESTRUCTIVE_FOUND=1
  fi
done < <(find prisma/migrations -name migration.sql -print0 2>/dev/null)

if [[ "$DESTRUCTIVE_FOUND" -eq 1 ]]; then
  echo ""
  echo "Review docs/MIGRATIONS.md — destructive changes require expand/contract across deploys."
  echo "Proceed only if this migration is intentional and sequenced correctly."
  exit 1
fi

echo "==> No destructive patterns detected in migration SQL."
echo "==> Run 'pnpm db:migrate:deploy' against the target database before starting new app instances."
