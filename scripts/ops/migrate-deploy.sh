#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "==> Pre-migration safety check"
bash scripts/ops/check-migrations.sh

echo "==> Applying Prisma migrations (migrate deploy)"
pnpm db:migrate:deploy

echo "==> Migrations applied successfully."
