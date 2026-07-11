#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="docker-compose.yml"
if [ ! -f "$COMPOSE_FILE" ]; then
  COMPOSE_FILE="infrastructure/docker-compose.yml"
fi

if docker info >/dev/null 2>&1; then
  docker compose -f "$COMPOSE_FILE" down
fi

if npx prisma dev ls 2>/dev/null | grep -q braids; then
  npx prisma dev stop braids || true
fi

echo "Local infrastructure stopped."
