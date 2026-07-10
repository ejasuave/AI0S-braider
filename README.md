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
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001/health

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

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in development |
| `pnpm lint` | ESLint across workspace |
| `pnpm typecheck` | TypeScript check |
| `pnpm test` | Vitest test suites |
| `pnpm build` | Production build |

See [CONTRIBUTING.md](CONTRIBUTING.md) and [BUILD_PROGRESS.md](BUILD_PROGRESS.md).
