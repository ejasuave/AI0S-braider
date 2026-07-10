# Build Progress — Project Braids

**Started:** 2026-07-10  
**Objective:** Production-quality MVP per Product Blueprint + Prompt Library Back Matter  
**Current milestone:** Chapter 1 complete — awaiting approval to begin Chapter 2

---

## Completed chapters

| Chapter | Status | Notes |
|---------|--------|-------|
| 1 — Project Setup | Complete | Prompts 1.1–1.8 verified: lint, typecheck, test, build pass |

### Chapter 1 deliverables

| Prompt | Deliverable |
|--------|-------------|
| 1.1 | pnpm + Turborepo monorepo (`apps/web`, `apps/api`, `packages/*`, `infrastructure/`) |
| 1.2 | Shared TS/ESLint/Prettier in `@project-braids/config`; Husky + lint-staged |
| 1.3 | Zod env schemas in `shared-types`; `.env.example` |
| 1.4 | Prisma at `prisma/`; singleton client; `GET /health/db`; seed scaffold |
| 1.5 | GitHub Actions CI (lint, typecheck, test, build + Postgres) |
| 1.6 | Module scaffolds + `CONTRIBUTING.md` |
| 1.7 | Docker Compose (Postgres 16 + Redis 7) |
| 1.8 | Pino logging + Sentry hooks + PII redaction |

## Pending chapters (MVP critical path)

| Chapter | Name | MVP |
|---------|------|-----|
| 2 | Architecture | Pending (awaiting approval) |
| 3 | Authentication | Pending |
| 4 | User Roles (4.1–4.2) | Pending |
| 6 | Stylist Features | Pending |
| 7 | Booking Engine | Pending |
| 8 | Calendar (8.1, 8.3) | Pending |
| 9 | Payments | Pending |
| 11 | Messaging (SMS) | Pending |
| 12 | Notifications | Pending |
| 13 | AI Receptionist | Pending |
| 17 | Dashboards (17.1–17.3) | Pending |
| 23 | Deployment | Pending |
| 24 | Mobile (24.1) | Pending |

## Architectural decisions

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-10 | pnpm workspaces + Turborepo | Prompt Library Ch.1 |
| 2026-07-10 | Prisma at repo root (`prisma/`) | Matches Blueprint §7; root CLI avoids schema path mismatch |
| 2026-07-10 | Scope `@project-braids/*` | Internal packages; display name via `PLATFORM_DISPLAY_NAME` |
| 2026-07-10 | Env validation in `shared-types` | Single Zod source for API + web (Ch.2.3 precursor) |
| 2026-07-10 | `pnpm approve-builds --all` in CI | pnpm 11 blocks postinstall scripts by default |

## Assumptions

- Node.js ≥ 20; pnpm 11+
- Docker for local Postgres + Redis
- Fresh clones run `pnpm approve-builds --all` after first `pnpm install` (pnpm 11 security default)

## Technical debt

| Item | Chapter | Notes |
|------|---------|-------|
| Prisma `package.json#prisma` seed config deprecated | 1 | Migrate to `prisma.config.ts` before Prisma 7 |
| Husky prepare fails without `.git` | 1 | Harmless until repo initialized |
| Next.js ESLint plugin detection warning on build | 1 | Flat config works; cosmetic warning only |
| Fastify `disableRequestLogging` deprecation | 1 | Removed; revisit when upgrading to Fastify 6 |

## Future improvements

- V2/V3 per Back Matter and Blueprint
- `prisma.config.ts` when upgrading Prisma 7
- Commit `pnpm` approved-builds config once pnpm documents stable file location

## Blockers

| Item | Status |
|------|--------|
| — | — |
