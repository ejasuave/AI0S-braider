# Project Braids

AI receptionist and operating system for independent UK hair braiders and hairstylists.

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for local Postgres + Redis)

## Quick start

```bash
pnpm install
pnpm approve-builds --all   # required on pnpm 11+ for Prisma/Next postinstall scripts
docker compose -f infrastructure/docker-compose.yml up -d
cp .env.example .env
pnpm db:generate
pnpm db:migrate
pnpm dev          # terminal 1: API + web
pnpm worker:dev   # terminal 2: background job worker
```

- Web: http://localhost:3000
- API: http://localhost:3001/health
- API ping: http://localhost:3001/api/v1/ping

## Monorepo layout

```
apps/web/              Next.js stylist dashboard shell
apps/api/              Fastify REST API
packages/shared-types/ Zod schemas + shared TypeScript types
packages/config/       ESLint, Prettier, TypeScript configs
prisma/                Database schema and migrations
infrastructure/        Docker Compose for local dev
```

## Scripts

| Command           | Description                    |
| ----------------- | ------------------------------ |
| `pnpm dev`        | Start API + web in development |
| `pnpm worker:dev` | Start background job worker    |
| `pnpm lint`       | ESLint across workspace        |
| `pnpm typecheck`  | TypeScript check               |
| `pnpm test`       | Vitest test suites             |
| `pnpm build`      | Production build               |

See [CONTRIBUTING.md](CONTRIBUTING.md) and [BUILD_PROGRESS.md](BUILD_PROGRESS.md).
