# Architecture — Project Braids

**Status:** Chapter 2 (authoritative for all subsequent builds)  
**Last updated:** 2026-07-10

This document defines service boundaries, cross-module rules, and patterns every feature must follow. If implementation diverges from this file, update this document in the same commit.

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

**apps/worker** runs as a separate process (`apps/api` worker entry) consuming the same Redis queue.

---

## Service boundaries

Each module owns its domain logic, database tables, and HTTP routes. **Never query another module's tables directly** — call the owning module's service layer.

| Module            | Path                     | Owns                                        | Does not own                                |
| ----------------- | ------------------------ | ------------------------------------------- | ------------------------------------------- |
| **identity**      | `modules/identity/`      | Auth, sessions, roles, OTP                  | Profile content                             |
| **profile**       | `modules/profile/`       | Bio, portfolio, pricing, policies           | Availability logic                          |
| **booking**       | `modules/booking/`       | Slots, holds, confirmations, cancellations  | Payment capture                             |
| **receptionist**  | `modules/receptionist/`  | Conversation state, intent, price lookup    | Calendar source of truth                    |
| **payments**      | `modules/payments/`      | Deposits, refunds, payouts, Stripe webhooks | Pricing decisions                           |
| **notifications** | `modules/notifications/` | Reminder delivery, STOP compliance          | Message content (delegates to receptionist) |
| **messaging**     | `modules/messaging/`     | SMS ingress/egress, Twilio webhooks         | Business logic                              |
| **system**        | `modules/system/`        | Ping, example jobs, platform health         | Domain features                             |

### Cross-module rules

1. **Tenant scoping:** Stylist-owned data uses `request.auth.stylistId` from identity middleware (Ch.4). Never trust client-supplied tenant ids.
2. **Platform-wide clients:** Client identity keyed by E.164 phone in `users` (Ch.3).
3. **Idempotency:** All webhooks and retriable writes use `processed_webhook_events` or domain-specific idempotency keys.
4. **Validation:** Zod schemas live in `@project-braids/shared-types`. API validates on ingress; web imports types only.
5. **Errors:** All `/api/v1/*` endpoints return the standard error envelope (see `docs/API_CONVENTIONS.md`).

---

## API surface

| Surface       | Prefix                  | Purpose                                              |
| ------------- | ----------------------- | ---------------------------------------------------- |
| Health probes | `/health`, `/health/db` | Load balancers, Docker, k8s — no versioning          |
| Business API  | `/api/v1/*`             | All product endpoints — versioned for native clients |
| Webhooks      | `/api/v1/webhooks/*`    | Inbound provider events (Stripe, Twilio)             |

---

## Frontend architecture

- **apps/web** is a thin client. All reads/writes go through `src/shared/lib/api-client.ts`.
- Feature UI lives in `src/features/<module>/` with TanStack Query hooks.
- **No business logic in React components.**
- **No Server Actions** as canonical write path.
- **No Prisma** in apps/web (except future HttpOnly cookie helpers).

See `docs/BFF.md` for the optional Next.js BFF boundary.

---

## Background jobs

- **Queue:** BullMQ on Redis (`REDIS_URL`).
- **Producer:** API enqueues jobs via `src/lib/queue.ts`.
- **Consumer:** `src/worker.ts` (separate process in production).
- Job names use dot notation: `system.example-ping`, `booking.expire-hold`.
- Jobs must be idempotent — safe to retry on failure.

---

## Webhook processing

All inbound webhooks follow the four-step sequence in `src/lib/webhooks/idempotent-handler.ts`:

1. Verify provider signature (when applicable)
2. Check `processed_webhook_events` for duplicate `event_id`
3. Process the event inside a transaction
4. Record `event_id` as processed

See `docs/API_CONVENTIONS.md` § Webhooks.

---

## Anti-patterns (forbidden in code review)

- Prisma calls from `apps/web`
- Duplicated Zod schemas outside `shared-types`
- Booking/payment/AI logic in React components or Next.js route handlers
- Direct cross-module table queries
- Hard-coded API response shapes in frontend
- Caching real-time availability or payment state (Ch.21)

---

## Adding a new module

1. Create `apps/api/src/modules/<name>/` with `routes.ts`, `service.ts`, `repository.ts`
2. Create `apps/web/src/features/<name>/` for UI
3. Add Zod schemas to `packages/shared-types/src/api/<name>.ts`
4. Register routes in `apps/api/src/routes/v1.ts`
5. Update this document's module table
