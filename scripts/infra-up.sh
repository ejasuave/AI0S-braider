#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if docker info >/dev/null 2>&1; then
  echo "Starting Docker Compose (Postgres + Redis)..."
  docker compose -f infrastructure/docker-compose.yml up -d
  echo ""
  echo "Infrastructure ready."
  echo "  DATABASE_URL=postgresql://braids:braids@localhost:5432/braids_dev"
  echo "  REDIS_URL=redis://localhost:6379"
  echo ""
  echo "Run: pnpm db:migrate:deploy"
  exit 0
fi

echo "Docker is not running — starting Prisma Dev local Postgres (no Redis)."
echo ""

if npx prisma dev ls 2>/dev/null | grep -q 'braids.*running'; then
  echo "Prisma Dev server 'braids' is already running."
else
  npx prisma dev --name braids --detach
fi

echo ""
echo "Set DATABASE_URL in .env to:"
echo "  postgresql://postgres:postgres@localhost:51214/braids_dev?sslmode=disable"
echo ""
echo "Then run:"
echo "  pnpm db:migrate:deploy"
echo "  pnpm dev"
echo ""
echo "Note: Redis still requires Docker for background jobs and rate limiting."
