#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="docker-compose.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
  COMPOSE_FILE="infrastructure/docker-compose.yml"
fi

ENV_FILE="$ROOT/.env"
PRISMA_DEV_APP_URL="postgresql://postgres:postgres@localhost:51214/braids_dev?sslmode=disable&pgbouncer=true"
PRISMA_DEV_MIGRATE_URL="postgresql://postgres:postgres@localhost:51214/braids_dev?sslmode=disable"

set_env_database_url() {
  local url="$1"
  if [ ! -f "$ENV_FILE" ]; then
    cp .env.example "$ENV_FILE"
    echo "Created .env from .env.example"
  fi
  if grep -q '^DATABASE_URL=' "$ENV_FILE"; then
    if grep -Fq "DATABASE_URL=$url" "$ENV_FILE"; then
      return 0
    fi
    # Portable in-place replace (Linux sed)
    sed -i "s|^DATABASE_URL=.*|DATABASE_URL=$url|" "$ENV_FILE"
    echo "Updated DATABASE_URL in .env"
  else
    printf '\nDATABASE_URL=%s\n' "$url" >>"$ENV_FILE"
    echo "Appended DATABASE_URL to .env"
  fi
}

# When Prisma Dev schema exists but _prisma_migrations drifted, mark failed steps applied and retry.
migrate_deploy_with_repair() {
  local url="$1"
  local attempt=0
  local max_attempts=30

  while [ "$attempt" -lt "$max_attempts" ]; do
    set +e
    output="$(DATABASE_URL="$url" pnpm db:migrate:deploy 2>&1)"
    status=$?
    set -e
    echo "$output"

    if [ "$status" -eq 0 ]; then
      return 0
    fi

    failed=""
    if echo "$output" | grep -q 'Migration name:'; then
      failed="$(echo "$output" | sed -n 's/.*Migration name: \([^[:space:]]*\).*/\1/p' | head -1)"
    elif echo "$output" | grep -q 'The `'; then
      failed="$(echo "$output" | sed -n 's/.*The `\([^`]*\)`.*/\1/p' | head -1)"
    fi

    if [ -z "$failed" ]; then
      echo ""
      echo "Migration deploy failed and could not be auto-repaired."
      return 1
    fi

    echo ""
    echo "Repairing dev migration history: marking $failed as applied (schema already present)..."
    DATABASE_URL="$url" npx prisma migrate resolve --applied "$failed" >/dev/null
    attempt=$((attempt + 1))
  done

  echo "Migration repair exceeded $max_attempts attempts."
  return 1
}

if docker info >/dev/null 2>&1; then
  echo "Starting Docker Compose (Postgres + Redis)..."
  docker compose -f "$COMPOSE_FILE" up -d
  echo ""
  set_env_database_url "postgresql://braids:braids@localhost:5432/braids_dev"
  echo "Infrastructure ready."
  echo "  DATABASE_URL=postgresql://braids:braids@localhost:5432/braids_dev"
  echo "  REDIS_URL=redis://localhost:6379"
  echo ""
  echo "Applying migrations..."
  migrate_deploy_with_repair "postgresql://braids:braids@localhost:5432/braids_dev"
  echo ""
  echo "Seeding reference data (style taxonomy)..."
  DATABASE_URL="postgresql://braids:braids@localhost:5432/braids_dev" pnpm db:seed
  echo ""
  echo "Done. Run: pnpm dev"
  exit 0
fi

echo "Docker is not running — starting Prisma Dev local Postgres (no Redis)."
echo ""

PRISMA_DEV_STATUS="$(npx prisma dev ls 2>/dev/null | awk '/^[[:space:]]*braids[[:space:]]/{print $2; exit}')"
if [ "${PRISMA_DEV_STATUS:-}" = "running" ]; then
  echo "Prisma Dev server 'braids' is already running."
else
  npx prisma dev --name braids --detach
  echo "Started Prisma Dev server 'braids'."
fi

set_env_database_url "$PRISMA_DEV_APP_URL"

echo ""
echo "Prisma Dev URLs:"
echo "  App (DATABASE_URL):    $PRISMA_DEV_APP_URL"
echo "  Migrations (direct):   $PRISMA_DEV_MIGRATE_URL"
echo ""
echo "Applying migrations (direct TCP — do not use pgbouncer for migrate)..."
migrate_deploy_with_repair "$PRISMA_DEV_MIGRATE_URL"
echo ""
echo "Seeding reference data (style taxonomy)..."
DATABASE_URL="$PRISMA_DEV_MIGRATE_URL" pnpm db:seed
echo ""
echo "Infrastructure ready."
echo ""
echo "Note: Redis still requires Docker for background jobs and rate limiting."
echo "Run: pnpm dev"
