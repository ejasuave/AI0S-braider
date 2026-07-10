# Contributing

## Repository conventions

### Backend (`apps/api`)

```
src/
  config/       Environment and app configuration
  lib/          Cross-cutting utilities (db, logger, sentry)
  modules/      Feature modules — one folder per domain
    <feature>/
      README.md
      routes.ts      (future)
      service.ts       (future)
      repository.ts    (future)
  routes/       Cross-cutting routes (health, v1 aggregator)
  jobs/         Background job processors
  worker.ts     Background worker entrypoint
```

**Rules:**

- Business logic lives in `modules/<feature>/service.ts`
- Never query another module's Prisma tables directly
- All tenant data scoped by `stylist_id` (from Ch.3 onward)
- Webhooks must be idempotent (use `lib/webhooks/idempotent-handler.ts`)
- All business endpoints under `/api/v1/` with standard error envelope
- Register new modules in `routes/v1.ts`; update `docs/ARCHITECTURE.md`

### Frontend (`apps/web`)

```
src/
  app/          Next.js App Router pages
  features/     Feature UI (one folder per domain)
  shared/
    lib/        api-client.ts — sole HTTP layer to apps/api
    components/ Shared UI primitives (shadcn/ui from Ch.2+)
```

**Rules:**

- No business logic in React components
- All data fetching via TanStack Query + `api-client.ts`
- No Server Actions as canonical write path
- Import types from `@project-braids/shared-types`

### Shared packages

- `@project-braids/shared-types` — Zod schemas + TS types consumed by API and web
- `@project-braids/config` — ESLint, Prettier, TypeScript configs

## Development workflow

1. Read relevant Blueprint + Playbook chapter before coding
2. Follow chapter execution protocol in `AGENTS.md`
3. Run `pnpm lint && pnpm typecheck && pnpm test` before opening a PR
4. Update `BUILD_PROGRESS.md` when completing a chapter

## Branch naming

`feature/ch<N>-<short-description>` e.g. `feature/ch3-auth-otp`
