# Contributing

## Repository conventions

### Backend (`apps/api`)

```
src/
  config/       Environment and app configuration
  lib/          Cross-cutting utilities (db, logger, sentry, rate limits)
  modules/      Feature modules — one folder per domain
    <feature>/
      README.md
      routes.ts
      service.ts
      repository.ts
      *.test.ts
  routes/       Cross-cutting routes (health, v1 aggregator)
  jobs/         Background job processors
  worker.ts     Background worker entrypoint
```

**Rules:**

- Business logic lives in `modules/<feature>/service.ts`
- Database access in `modules/<feature>/repository.ts`
- Zod request/response shapes live in `@project-braids/shared-types` (not per-module `schema.ts` duplicates)
- Never query another module's Prisma tables directly
- All tenant data scoped by `stylist_id`
- Webhooks must be idempotent (`lib/webhooks/idempotent-handler.ts`)
- All business endpoints under `/api/v1/` with standard error envelope
- Register new modules in `routes/v1.ts`; update `docs/ARCHITECTURE.md`

### Frontend (`apps/web`)

```
src/
  app/              Next.js App Router pages (thin route shells)
  features/<feature>/components/
  features/<feature>/hooks/
  shared/
    lib/            api-client.ts — sole HTTP layer to apps/api
    ui/             Shared UI primitives
```

**Rules:**

- No business logic in React components
- All data fetching via TanStack Query + `api-client.ts`
- No Server Actions as canonical write path
- Import types from `@project-braids/shared-types`

### Worked example: adding a `reviews` feature (Ch.1.6)

| Layer          | Path                                           |
| -------------- | ---------------------------------------------- |
| API routes     | `apps/api/src/modules/reviews/routes.ts`       |
| API service    | `apps/api/src/modules/reviews/service.ts`      |
| API repository | `apps/api/src/modules/reviews/repository.ts`   |
| API tests      | `apps/api/src/modules/reviews/reviews.test.ts` |
| Shared types   | `packages/shared-types/src/api/reviews.ts`     |
| Web UI         | `apps/web/src/features/reviews/components/`    |
| Web hooks      | `apps/web/src/features/reviews/hooks/`         |
| Web page       | `apps/web/src/app/stylist/reviews/page.tsx`    |

Register routes in `apps/api/src/routes/v1.ts` and document in `docs/ARCHITECTURE.md`.

### Shared packages

- `@project-braids/shared-types` — Zod schemas + TS types consumed by API and web
- `@project-braids/config` — ESLint, Prettier, TypeScript configs

## Logging conventions (Ch.1.8)

**API (`apps/api`)** uses Pino via `lib/logger.ts`.

| Level   | Use for                                           |
| ------- | ------------------------------------------------- |
| `debug` | Verbose dev-only detail                           |
| `info`  | Request lifecycle, startup, successful operations |
| `warn`  | Recoverable issues, deprecations                  |
| `error` | Failures requiring attention                      |

Every HTTP request logs method, path, status, duration, and `reqId` (from `x-request-id` or generated).

**PII redaction:** never log raw phone numbers, emails, passwords, tokens, or OTPs. Use `redactSensitiveLogFields()` or rely on the logger's built-in key list (`phone`, `phone_number`, `email`, `password`, `token`, `authorization`, `otp`, `refreshToken`).

**Web:** Sentry via `instrumentation.ts` when `SENTRY_DSN` is set; otherwise no-op.

**Observability test route (dev only):** `GET /health/error-test` — deliberate 500 for verifying error capture.

## Environment variables (Ch.1.3)

- `apps/api/.env.example` — API variables
- `apps/web/.env.example` — web variables (only `NEXT_PUBLIC_*` is browser-exposed)
- Copy both into a single `.env` at the repo root for local dev
- **Never commit** `.env` or production secrets

API validates env at startup via `parseApiEnv()` — missing required vars fail fast with a clear Zod error.

## Development workflow

1. Read relevant Blueprint + Playbook chapter before coding
2. Follow chapter execution protocol in `AGENTS.md`
3. Run `pnpm lint && pnpm typecheck && pnpm test` before opening a PR
4. Update `BUILD_PROGRESS.md` when completing a chapter

Pre-commit hook runs `lint-staged` (ESLint + Prettier on staged files) and `pnpm typecheck`.

## Branch naming

`feature/ch<N>-<short-description>` e.g. `feature/ch3-auth-otp`
