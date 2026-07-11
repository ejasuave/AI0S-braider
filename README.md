# Project Braids

![CI](https://github.com/REPLACE_WITH_ORG/project-braids/actions/workflows/ci.yml/badge.svg)

AI receptionist and operating system for independent UK hair braiders and hairstylists.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (recommended for Postgres + Redis) **or** Prisma Dev fallback via `pnpm infra:up`

## Quick start

```bash
pnpm install
pnpm approve-builds --all   # required on pnpm 11+ for Prisma/Next postinstall scripts
cp .env.example .env          # or merge apps/api/.env.example + apps/web/.env.example
pnpm infra:up                 # Docker Compose, or Prisma Dev if Docker is unavailable
pnpm db:generate
pnpm db:migrate:deploy
pnpm dev          # terminal 1: API + web
pnpm worker:dev   # terminal 2: background job worker (requires Redis / Docker)
```

- Web: http://localhost:3000
- API root: http://localhost:3001/ (service info + links)
- API: http://localhost:3001/health
- API DB health: http://localhost:3001/health/db
- API ping: http://localhost:3001/api/v1/ping

## Secrets and environment (Ch.1.3)

Copy `.env.example` to `.env` at the repo root. Per-app references:

- `apps/api/.env.example` — database, auth, Stripe, Twilio, Claude, observability
- `apps/web/.env.example` — `NEXT_PUBLIC_*` only (safe for browser)

Use sandbox/test credentials locally. **Never commit real production secrets.**

The API validates all required variables at startup and exits with a clear error if any are missing or malformed.

## Monorepo layout (Ch.1.1)

```
apps/web/              Next.js stylist + client web app
apps/api/              Fastify REST API
packages/shared-types/ Zod schemas + shared TypeScript types
packages/config/       ESLint, Prettier, TypeScript configs
prisma/                Database schema and migrations
infrastructure/        Dockerfiles, Fly.io templates
docker-compose.yml     Local Postgres + Redis (Ch.1.7)
```

## Local infrastructure (Ch.1.7)

```bash
pnpm infra:up    # docker compose up -d (Postgres + Redis)
pnpm infra:down
```

Apps run on the host (not in Docker) for fast hot-reload. Only Postgres and Redis run in containers.

| Service                | URL                                                    |
| ---------------------- | ------------------------------------------------------ |
| Postgres (Docker)      | `postgresql://braids:braids@localhost:5432/braids_dev` |
| Redis                  | `redis://localhost:6379`                               |
| Prisma Dev (no Docker) | `pnpm infra:up` prints the URL                         |

### Troubleshooting

| Problem                                         | Fix                                                                                |
| ----------------------------------------------- | ---------------------------------------------------------------------------------- |
| `Internal server error` / DB connection refused | Run `pnpm infra:up`, confirm `DATABASE_URL` in `.env`, restart `pnpm dev`          |
| Port 5432 or 6379 already in use                | Stop conflicting services or change ports in `docker-compose.yml`                  |
| Stale Docker data                               | `pnpm infra:down` then `docker volume rm project-braids-postgres_data` (if needed) |
| Missing `.env`                                  | `cp .env.example .env` and fill in values                                          |
| `pnpm infra: up` fails                          | Use `pnpm infra:up` (no space)                                                     |
| API starts but auth fails                       | Ensure `JWT_SECRET` is at least 32 characters                                      |
| Redis warnings in dev                           | Start Docker Redis, or accept in-memory fallbacks for some features                |

## Database migrations (Ch.1.4)

```bash
pnpm db:migrate        # local dev — creates migration + applies
pnpm db:migrate:deploy # CI/production — apply pending only
pnpm db:seed           # seed style taxonomy
```

Health check: `GET /health/db` returns connectivity and latency.

## Scripts

| Command                      | Description                                  |
| ---------------------------- | -------------------------------------------- |
| `pnpm dev`                   | Start API + web in development               |
| `pnpm infra:up`              | Start local Postgres (+ Redis via Docker)    |
| `pnpm infra:down`            | Stop local infrastructure                    |
| `pnpm worker:dev`            | Start background job worker                  |
| `pnpm lint`                  | ESLint across workspace                      |
| `pnpm typecheck`             | TypeScript check                             |
| `pnpm test`                  | Vitest test suites                           |
| `pnpm build`                 | Production build                             |
| `pnpm ops:kill-switch-drill` | Verify AI kill switch via ops-status (Ch.23) |
| `pnpm ops:migrate-deploy`    | Safe migration deploy to target DATABASE_URL |
| `pnpm ops:rollback`          | Print rollback runbook                       |

## CI (Ch.1.5)

GitHub Actions runs **lint**, **typecheck**, and **test** in parallel on every PR and push to `main`. The test job provisions ephemeral Postgres and Redis service containers.

Replace `REPLACE_WITH_ORG/project-braids` in the CI badge URL above with your GitHub org/repo when published.

See [CONTRIBUTING.md](CONTRIBUTING.md), [BUILD_PROGRESS.md](BUILD_PROGRESS.md), and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
