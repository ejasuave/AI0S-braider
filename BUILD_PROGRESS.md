# Build Progress — Project Braids

**Started:** 2026-07-10  
**Objective:** Production-quality MVP per Product Blueprint + Prompt Library Back Matter  
**Current milestone:** Chapter 2 complete — awaiting approval to begin Chapter 3

---

## Completed chapters

| Chapter           | Status   | Notes                                      |
| ----------------- | -------- | ------------------------------------------ |
| 1 — Project Setup | Complete | Commit `aba627c`                           |
| 2 — Architecture  | Complete | Service boundaries, v1 API, jobs, webhooks |

### Chapter 2 deliverables

| Prompt | Deliverable                                                                     |
| ------ | ------------------------------------------------------------------------------- |
| 2.1    | `docs/ARCHITECTURE.md` — module boundaries, anti-patterns                       |
| 2.2    | `/api/v1/*` versioning, `ApiError` envelope, `docs/API_CONVENTIONS.md`          |
| 2.3    | `shared-types/api/*` schemas, `apiFetchData`, `usePing` hook                    |
| 2.4    | `docs/BFF.md` — thin-client boundary, no business logic in Next routes          |
| 2.5    | BullMQ + Redis worker (`worker:dev`), example job end-to-end                    |
| 2.6    | `processed_webhook_events` table, `processWebhookIdempotently`, example webhook |

## Pending chapters (MVP critical path)

| Chapter | Name                   | MVP                         |
| ------- | ---------------------- | --------------------------- |
| 3       | Authentication         | Pending (awaiting approval) |
| 4       | User Roles (4.1–4.2)   | Pending                     |
| 6       | Stylist Features       | Pending                     |
| 7       | Booking Engine         | Pending                     |
| 8       | Calendar (8.1, 8.3)    | Pending                     |
| 9       | Payments               | Pending                     |
| 11      | Messaging (SMS)        | Pending                     |
| 12      | Notifications          | Pending                     |
| 13      | AI Receptionist        | Pending                     |
| 17      | Dashboards (17.1–17.3) | Pending                     |
| 23      | Deployment             | Pending                     |
| 24      | Mobile (24.1)          | Pending                     |

## Architectural decisions

| Date       | Decision                                   | Rationale                                       |
| ---------- | ------------------------------------------ | ----------------------------------------------- |
| 2026-07-10 | pnpm workspaces + Turborepo                | Prompt Library Ch.1                             |
| 2026-07-10 | Prisma at repo root (`prisma/`)            | Matches Blueprint §7                            |
| 2026-07-10 | Scope `@project-braids/*`                  | Internal packages                               |
| 2026-07-10 | Env validation in `shared-types`           | Single Zod source for API + web                 |
| 2026-07-10 | `pnpm approve-builds --all` in CI          | pnpm 11 blocks postinstall scripts              |
| 2026-07-10 | BullMQ connection options object           | Avoids ioredis duplicate-type issue with BullMQ |
| 2026-07-10 | Health at `/health`, business at `/api/v1` | Infra probes unversioned; product API versioned |
| 2026-07-10 | Worker as separate process                 | Matches production deploy (api + workers)       |

## Assumptions

- Node.js ≥ 20; pnpm 11+
- Docker for local Postgres + Redis
- `REDIS_URL` required for job queue features

## Technical debt

| Item                                                | Chapter | Notes                                         |
| --------------------------------------------------- | ------- | --------------------------------------------- |
| Prisma `package.json#prisma` seed config deprecated | 1       | Migrate to `prisma.config.ts` before Prisma 7 |
| Next.js ESLint plugin detection warning on build    | 1       | Cosmetic only                                 |
| `example_job_runs` table is demonstration-only      | 2       | Remove or repurpose when real jobs ship       |

## Future improvements

- V2/V3 per Back Matter and Blueprint
- OpenAPI spec generation from shared-types (Ch.22+)

## Blockers

| Item | Status |
| ---- | ------ |
| —    | —      |
