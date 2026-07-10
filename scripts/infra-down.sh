#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if docker info >/dev/null 2>&1; then
  docker compose -f infrastructure/docker-compose.yml down
fi

if npx prisma dev ls 2>/dev/null | grep -q braids; then
  npx prisma dev stop braids || true
fi

echo "Local infrastructure stopped."
