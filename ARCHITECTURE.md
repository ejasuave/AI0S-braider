# Architecture — Project Braids

**Every feature prompt executed in this codebase must be checked against this document.** If a prompt would require one service to reach into another service's owned data or logic directly, flag that conflict before proceeding rather than implementing it silently.

**Last updated:** 2026-07-20 (AI receptionist session memory + FAQ topic switch; stylist catalogs/slugs)

This document defines service boundaries, cross-module rules, and patterns every feature must follow. If implementation diverges from this file, update this document in the same commit.

Related: [docs/API_CONVENTIONS.md](docs/API_CONVENTIONS.md) · [docs/BFF.md](docs/BFF.md) · [docs/BACKGROUND_JOBS.md](docs/BACKGROUND_JOBS.md) · [docs/WEBHOOK_CONVENTIONS.md](docs/WEBHOOK_CONVENTIONS.md) · [docs/PERMISSIONS.md](docs/PERMISSIONS.md) · [docs/REALTIME.md](docs/REALTIME.md)

---

## System overview

Project Braids is an AI receptionist and operating system for independent UK hair professionals. The core value unit is a **completed, confirmed, paid booking** created with minimal stylist effort.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐
│  apps/web   │     │ Future      │     │      apps/api           │
│  (Next.js)  │     │ iOS/Android │────▶│  REST /api/v1           │
│  MVP launch │────▶│   (later)   │     │  All business logic     │
└─────────────┘     └─────────────┘     └───────────┬─────────────┘
       │                                            │
       │ typed API client                           ├── Prisma → Postgres
       └────────────────────────────────────────────├── BullMQ → Redis (jobs)
                                                    ├── Claude (receptionist)
                                                    ├── Stripe (payments)
                                                    └── Twilio (messaging)
```

**Worker:** `apps/api/src/worker.ts` — separate process consuming the same Redis queue (Ch.2.5).

**Module folders:** per [CONTRIBUTING.md](CONTRIBUTING.md) — `apps/api/src/modules/<feature>/`.

---

## Service boundaries

Each module owns its domain logic, database tables, and HTTP routes. **Never query another module's tables directly** — call the owning module's service layer.

| Service                | Module path                   | Owns                                                                                                         | Does not own                                                        |
| ---------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| **Identity**           | `modules/identity/`           | Authentication, sessions, OTP                                                                                | Profile content, permission evaluation                              |
| **Roles**              | `modules/roles/`              | Businesses, staff permissions, guards, impersonation audit                                                   | Profile content, auth session issuance                              |
| **Stylist Profile**    | `modules/stylist-profile/`    | Bio, portfolio, pricing taxonomy, policies, availability rules                                               | Slot computation (Calendar module)                                  |
| **Profile (legacy)**   | `modules/profile/`            | Directory search, legacy `/profile/*` compat                                                                 | New Ch.6 routes (use stylist-profile)                               |
| **Calendar**           | `modules/calendar/`           | Availability computation, buffer settings, Google Calendar sync                                              | Working-hours storage, booking state                                |
| **Booking Engine**     | `modules/booking/`            | Slot holds, confirmations, cancellations, state machine                                                      | Payment capture                                                     |
| **AI Receptionist**    | `modules/receptionist/`       | Conversation state, session memory, intent, escalation, booking dispatch                                     | Calendar source of truth                                            |
| **Payments**           | `modules/payments/`           | Deposit capture, refunds, Stripe webhooks                                                                    | Pricing decisions                                                   |
| **Notifications**      | `modules/notifications/`      | Reminder scheduling/delivery, lifecycle notices, preference gating at send                                   | Message content generation (stub in `content.ts`; Ch.13 may enrich) |
| **Client preferences** | `modules/client-preferences/` | `notification_preferences`, STOP/START keywords (Ch.5.4), `client_profiles`, `saved_stylists`, opt-out audit | Notification delivery timing                                        |
| **Messaging**          | `modules/messaging/`          | Conversations, SMS + in-app web chat, `sendMessage`/`receiveMessage`, handoff                                | AI content (Ch.13), notification jobs (Ch.12)                       |
| **Realtime**           | `modules/realtime/`           | Stylist SSE fan-out from domain events (Ch.17.5)                                                             | Business logic; persists nothing                                    |
| **Directory**          | `modules/directory/`          | Beta public stylist search (read-only)                                                                       | Profile writes, booking state                                       |
| **System**             | `modules/system/`             | Ping, ops status, Ch.2 example jobs                                                                          | Domain features                                                     |

### Allowed cross-service calls

| Caller             | May call (service layer)                                | Must never                                  |
| ------------------ | ------------------------------------------------------- | ------------------------------------------- |
| Receptionist       | `messaging`, `profile`, `booking`, `payments` services  | Query `bookings`/`messages` tables directly |
| Booking            | `profile` (offerings, hours)                            | `payments` tables; capture deposits itself  |
| Payments           | `booking` service to confirm after deposit              | Set `agreedPrice` or pricing policy         |
| Notifications      | `messaging.sendMessage`, domain events from Booking     | Generate AI conversation content            |
| Messaging          | `identity` (client lookup), `client-preferences` (STOP) | Run Claude turns                            |
| Client preferences | `identity` (user by phone)                              | Send notifications                          |
| Profile            | `storage` lib only                                      | Compute availability slots                  |
| Directory          | `profile` read APIs                                     | Update stylist profiles                     |

### Cross-cutting infrastructure (no feature owner)

| Asset                                 | Location                         | Purpose                                |
| ------------------------------------- | -------------------------------- | -------------------------------------- |
| `processed_webhook_events`            | Prisma / Postgres                | Webhook idempotency ledger (Ch.2.6)    |
| `businesses` / `business_staff`       | Prisma / Postgres                | Multi-staff permission scoping (Ch.4)  |
| `business_policies` / `working_hours` | Prisma / Postgres                | Policies + schedule rules (Ch.6)       |
| `impersonation_sessions`              | Prisma / Postgres                | Admin impersonation audit (Ch.4.4)     |
| `lib/queue.ts`                        | `apps/api/src/lib/`              | Shared BullMQ connection               |
| Shared types                          | `packages/shared-types/src/api/` | Zod schemas + `z.infer` types (Ch.2.3) |

### Cross-module rules

1. **Tenant scoping:** Stylist-owned data uses `request.auth.stylistId` from identity middleware. Never trust client-supplied tenant ids.
2. **Platform-wide clients:** Client identity keyed by E.164 phone in `users` (Ch.3).
3. **Idempotency:** Webhooks use `processWebhookIdempotently()`; other retriable writes use domain-specific keys.
4. **Validation:** Zod schemas in `@project-braids/shared-types`; API validates on ingress; web imports types only.
5. **Errors:** Standard envelope on all `/api/v1/*` routes — [docs/API_CONVENTIONS.md](docs/API_CONVENTIONS.md).

---

## API surface

| Surface       | Prefix                  | Purpose                                           |
| ------------- | ----------------------- | ------------------------------------------------- |
| Health probes | `/health`, `/health/db` | Load balancers — unversioned                      |
| Business API  | `/api/v1/*`             | All product endpoints                             |
| Webhooks      | `/api/v1/webhooks/*`    | Stripe, Twilio — no user auth; signature required |

---

## Frontend architecture (Ch.2.4)

- **apps/web** calls **apps/api** directly via `src/shared/lib/api-client.ts` (no BFF for business logic).
- TanStack Query hooks in `src/features/<module>/`; documented query-key convention in [docs/BFF.md](docs/BFF.md).
- **No `fetch` in components** — use typed client + hooks.
- **No Server Actions** as canonical write path.
- **No Prisma** in apps/web.

---

## Background jobs (Ch.2.5)

See [docs/BACKGROUND_JOBS.md](docs/BACKGROUND_JOBS.md). Job handlers live in the **owning module** (`src/jobs/` or `modules/<feature>/jobs/`). Shared queue wiring: `lib/queue.ts`.

---

## Webhook processing (Ch.2.6)

See [docs/WEBHOOK_CONVENTIONS.md](docs/WEBHOOK_CONVENTIONS.md). Utility: `lib/webhooks/idempotent-handler.ts`.

---

## Anti-patterns (forbidden in code review)

- Prisma calls from `apps/web`
- Duplicated Zod schemas outside `shared-types`
- Business logic in React components or Next.js route handlers
- Direct cross-module table queries
- Hard-coded API response shapes in frontend
- Webhook handlers without signature verification
- Caching real-time availability or payment state (Ch.21)

---

## Adding a new module

1. `apps/api/src/modules/<name>/` — `routes.ts`, `service.ts`, `repository.ts`
2. `apps/web/src/features/<name>/` — components + hooks
3. `packages/shared-types/src/api/<name>.ts` — Zod schemas
4. Register routes in `apps/api/src/routes/v1.ts`
5. Update this document's service table
