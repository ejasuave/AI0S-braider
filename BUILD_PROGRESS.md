# Build Progress — Project Braids

**Started:** 2026-07-10  
**Objective:** Production-quality MVP per Product Blueprint + Prompt Library Back Matter  
**Current milestone:** MVP handbook complete (Ch.1–25). Beta ship per Back Matter checklist.

---

## Web UI (Ch.1–9 + beta directory)

Mobile-first Next.js app at `apps/web` — tokens from `reference/design/visual-identity-and-ux.md`.

| Route                                  | Purpose                                                        |
| -------------------------------------- | -------------------------------------------------------------- |
| `/`                                    | Landing — stylist / client entry                               |
| `/login`, `/register/*`, `/verify`     | Auth (email+password stylists; phone OTP all)                  |
| `/stylist`                             | Dashboard — **escalations first**, today's bookings, shortcuts |
| `/stylist/bookings`                    | **Week calendar** + day-filtered appointment list              |
| `/stylist/inbox`                       | Escalated + all SMS conversations                              |
| `/client`                              | Client home, bookings, inbox link, **sign out**                |
| `/client/inbox`, `/client/inbox/[id]`  | Client SMS conversation history (Ch.11.1)                      |
| `/directory`, `/directory/[stylistId]` | **Beta** public stylist search (opt-in)                        |
| `/book?stylistId=&serviceOfferingId=`  | Public booking link → hold → deposit                           |
| `/status`                              | API / DB health (dev)                                          |

---

## Completed chapters

| Chapter                          | Status   | Notes                                                                                   |
| -------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| 1 — Project Setup                | Complete | `aba627c`                                                                               |
| 2 — Architecture                 | Complete | `13b6544`                                                                               |
| 3 — Authentication               | Complete | `921b99f`                                                                               |
| 4 — User Roles (4.1–4.2)         | Complete | `ef0cb45`                                                                               |
| 6 — Stylist Features             | Complete | `7ef6e26`                                                                               |
| 7 — Booking Engine               | Complete | `5e43991`                                                                               |
| 8 — Calendar (8.1, 8.3)          | Complete | `d387b9b`                                                                               |
| 9 — Payments (9.1–9.4)           | Complete | Stripe Connect, deposits, idempotent webhooks                                           |
| 11 — Messaging (11.1–11.2, 11.5) | Complete | Conversations schema, Twilio SMS, stylist handoff                                       |
| 13 — AI Receptionist (13.1–13.8) | Complete | Claude structured turns, escalation, booking dispatch, tests                            |
| 12 — Notifications (12.1–12.4)   | Complete | Schema, reminder worker, confirmation/cancel notices, STOP compliance                   |
| Beta directory                   | Complete | Opt-in `directory_visible`, search API, `/directory` web UI (Ch.16 deferred)            |
| 17 — Dashboards (17.1–17.3)      | Complete | Week calendar, escalation-first home, inbox badge, AI message styling                   |
| 23 — Deployment (23.1–23.4)      | Complete | CI/CD, staging/prod workflows, ops-status, kill switch, migration safety                |
| 24 — Mobile (24.1)               | Complete | Layout audit, 5-tab nav, calendar/inbox fixes — [MOBILE_AUDIT.md](docs/MOBILE_AUDIT.md) |
| 25 — Future Features             | Complete | Deferred-feature registry — [FUTURE_FEATURES.md](docs/FUTURE_FEATURES.md) (docs only)   |

### Chapter 25 deliverables (documentation only)

| Prompt | Deliverable                                                           |
| ------ | --------------------------------------------------------------------- |
| 25.1   | Waitlist — trigger, deps, implementation sketch in FUTURE_FEATURES.md |
| 25.2   | Multi-staff salons — audit notes, mini build-order guidance           |
| 25.3   | Take-rate — Ch.9 revisit checklist                                    |
| 25.4   | Product/affiliate — decision gate (affiliate vs marketplace)          |
| 25.5   | Course hosting — strategic reconsideration gate                       |

**Not implemented** — Back Matter excludes Ch.25 from the build target.

### Chapter 24 deliverables (MVP scope)

| Prompt | Deliverable                                                                                 |
| ------ | ------------------------------------------------------------------------------------------- |
| 24.1   | Responsive layout audit + fixes; `docs/MOBILE_AUDIT.md`; touch-target + week-calendar tests |
| 24.2   | Deferred V2 — touch/interaction optimization                                                |
| 24.3   | Deferred V2 — mobile performance (requires Ch.21)                                           |
| 24.4   | Deferred V2 — PWA installability                                                            |

### Chapter 23 deliverables (MVP scope)

| Prompt | Deliverable                                                                     |
| ------ | ------------------------------------------------------------------------------- |
| 23.1   | CI (`ci.yml`) + staging deploy on `main` + manual production workflow           |
| 23.2   | `.env.staging.example`, isolated env docs, Fly.toml templates                   |
| 23.3   | Kill switch drill script, rollback runbook, `GET /system/ops-status`            |
| 23.4   | `check-migrations.sh`, `migrate-deploy.sh`, [MIGRATIONS.md](docs/MIGRATIONS.md) |

### Chapter 3 deliverables (aligned to prompt library)

| Prompt | Deliverable                                                                                                         |
| ------ | ------------------------------------------------------------------------------------------------------------------- |
| 3.1    | `users` schema, Argon2 passwords, `POST /signup`, shared `authUserSchema` + internal schema, CONFLICT on duplicates |
| 3.2    | `otp_challenges`, SMS provider abstraction, OTP verify creates client only after success, consumed-code error       |
| 3.3    | `oauth_accounts` + encrypted tokens, Google PKCE start/callback, OAuth account linking + new user creation          |
| 3.4    | `sessions` with rotation, reuse detection, unified `issueSession` for all login paths                               |
| 3.5    | Password reset (30 min), email provider, `phone_number_change_requests`, `approvePhoneChangeRequest` (Ch.19)        |
| 3.6    | `lib/security/rate-limit.ts`, `security.test.ts`, [docs/SECURITY.md](docs/SECURITY.md)                              |

### Chapter 2 deliverables (aligned to prompt library)

| Prompt | Deliverable                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------- |
| 2.1    | Root `ARCHITECTURE.md` — service owns/does-not-own, allowed cross-calls, conflict-check statement |
| 2.2    | `docs/API_CONVENTIONS.md` — envelopes, error codes, middleware chain; `GET /api/v1/ping`          |
| 2.3    | `paginationParamsSchema` in shared-types; ping + `usePingWithPagination`; anti-pattern docs       |
| 2.4    | Typed `api-client.ts`, TanStack Query key convention in `docs/BFF.md`, `/status` ping chain       |
| 2.5    | BullMQ worker, heartbeat (60s) + delayed example jobs; `docs/BACKGROUND_JOBS.md`                  |
| 2.6    | `processed_webhook_events`, `processWebhookIdempotently`, `docs/WEBHOOK_CONVENTIONS.md`, tests    |

### Chapter 1 deliverables (aligned to prompt library)

| Prompt | Deliverable                                                                                                                  |
| ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 1.1    | pnpm + Turborepo monorepo: `apps/web`, `apps/api`, `packages/shared-types`, `packages/config`, `infrastructure`              |
| 1.2    | Shared TS/ESLint/Prettier in `packages/config`; root `lint`/`typecheck`; husky + lint-staged + typecheck pre-commit          |
| 1.3    | `apps/api/.env.example`, `apps/web/.env.example`, root `.env.example`; Zod startup validation (`parseApiEnv`, `parseWebEnv`) |
| 1.4    | Prisma + singleton `lib/db.ts`, `GET /health/db`, `prisma/seed.ts`, migration docs                                           |
| 1.5    | `.github/workflows/ci.yml` — parallel lint, typecheck, test (Postgres + Redis services)                                      |
| 1.6    | Module conventions + worked `reviews` example in `CONTRIBUTING.md`                                                           |
| 1.7    | Root `docker-compose.yml`, `pnpm infra:up`/`down`, README troubleshooting                                                    |
| 1.8    | Pino structured logging, request IDs, Sentry (API + web instrumentation), PII redaction + tests, `/health/error-test`        |

### Chapter 17 deliverables (MVP scope)

| Prompt | Deliverable                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------- |
| 17.1   | Stylist shell: bottom nav (Home, **Calendar**, Inbox w/ badge), escalation-first home, skeletons, `aria-live` |
| 17.2   | Week calendar on `/stylist/bookings`; `GET /bookings?from=&to=`; **Today** section on home                    |
| 17.3   | Inbox dedupe, AI purple accent on assistant messages, reply + resolve (from Ch.11)                            |
| 17.4   | Deferred V2 — client dashboard polish                                                                         |
| 17.5   | Deferred V2 — WebSocket/SSE real-time (60s poll on inbox count for now)                                       |

### Beta directory (founder override — pre-Ch.17)

| Deliverable                               | Notes                                                      |
| ----------------------------------------- | ---------------------------------------------------------- |
| `directory_visible` on `stylist_profiles` | Default false; opt-in only                                 |
| `GET /api/v1/directory/stylists`          | Filter by q, location, style; paginated (max 50)           |
| `GET /api/v1/directory/stylists/:id`      | Public card + services → existing `/book` flow             |
| Web `/directory`                          | Search + profile pages; stylist toggle on profile settings |

Full Ch.16 (search index, availability ranking, scrape protection) remains Phase 2.

### Chapter 12 deliverables (MVP scope)

| Prompt | Deliverable                                                                           |
| ------ | ------------------------------------------------------------------------------------- |
| 12.1   | `notifications` + `sms_preferences` schema, BullMQ deliver/sweep jobs                 |
| 12.2   | 48h/2h reminder scheduling with cancellation-before-send guard                        |
| 12.3   | Confirmation/cancellation/no-show hooks on booking lifecycle                          |
| 12.4   | STOP/START keyword handling — halts AI, allows transactional SMS (Blueprint override) |

### Chapter 13 deliverables (aligned to prompt library)

| Prompt | Deliverable                                                                                           |
| ------ | ----------------------------------------------------------------------------------------------------- |
| 13.1   | `handleInboundMessage`, bounded history (`AI_RECEPTIONIST_MAX_HISTORY_MESSAGES`), timezone context    |
| 13.2   | `receptionistTurnOutputSchema`, retry-then-`structured_output_validation_failed` escalate             |
| 13.3   | Slot merge with style-change invalidation; one-question-at-a-time prompt; golden functional set       |
| 13.4   | Deterministic `lookupPricing` + `getAvailability` (max 3 slots); `proposed_slots` on messages         |
| 13.5   | Hold + deposit link; SLOT_UNAVAILABLE re-offer; ambiguous slot → escalate                             |
| 13.6   | Consolidated `shouldEscalate()`; standard reason strings; escalation model metadata on DB             |
| 13.7   | Injection detection + inbound rate limit; 10 adversarial fixtures; `AI_RECEPTIONIST_SECURITY.md`      |
| 13.8   | Unified golden-set + `receptionist:evaluate`; sample-escalations CLI; `AI_RECEPTIONIST_EVALUATION.md` |

### Chapter 11 deliverables (aligned to prompt library)

| Prompt | Deliverable                                                                             |
| ------ | --------------------------------------------------------------------------------------- |
| 11.1   | Schema + `sendMessage`/`receiveMessage` + paginated stylist/client read APIs + tests    |
| 11.2   | Twilio inbound webhook, STOP via Ch.12 opt-out, delivery status callbacks, SMS/OTP docs |
| 11.3   | Deferred V2 — WhatsApp (schema ready)                                                   |
| 11.4   | Deferred V2 — web chat widget (schema ready)                                            |
| 11.5   | `isEscalated`, escalation stylist SMS notify, stylist reply, resolve handoff            |

### Chapter 9 deliverables (MVP scope)

| Prompt | Deliverable                                                        |
| ------ | ------------------------------------------------------------------ |
| 9.1    | `POST /api/v1/payments/connect/onboard`, `GET /connect/status`     |
| 9.2    | `POST /api/v1/payments/deposits` — PaymentIntent for held bookings |
| 9.3    | Deferred V2 — refund/forfeiture on cancellation                    |
| 9.4    | `POST /api/v1/webhooks/stripe` — signature + idempotency ledger    |
| 9.5    | Deferred V2 — payout scheduling                                    |
| 9.6    | Deferred V2 — chargeback evidence                                  |

### Chapter 8 deliverables (MVP scope)

| Prompt | Deliverable                                                        |
| ------ | ------------------------------------------------------------------ |
| 8.1    | `GET /api/v1/bookings/availability` computation engine             |
| 8.2    | Deferred V2 — Google Calendar sync                                 |
| 8.3    | Duration + buffer-aware slot generation from profile working hours |
| 8.4    | Deferred V2 — Calendar reconciliation job                          |

## Pending chapters (MVP critical path)

| Chapter | Name         | Status   |
| ------- | ------------ | -------- |
| —       | MVP handbook | Complete |

**Next:** Beta ship checklist ([back-matter.md](reference/prompt-library/back-matter.md)) or pick a Ch.25 item when its trigger condition is met.

## Architectural decisions

| Date       | Decision                                        | Rationale                                                 |
| ---------- | ----------------------------------------------- | --------------------------------------------------------- |
| 2026-07-10 | Availability logic in `booking` module          | ARCHITECTURE.md — profile owns hours, booking owns slots  |
| 2026-07-10 | `Europe/London` default timezone                | UK-only MVP per Blueprint                                 |
| 2026-07-10 | Client holds validate against generated slots   | Ties Ch.8 to Ch.7 hold creation                           |
| 2026-07-10 | Manual stylist bookings skip availability check | Walk-in / off-platform blocks per Playbook                |
| 2026-07-10 | `StripeProvider` abstraction (live + mock)      | Local dev without Stripe keys; test-mode when configured  |
| 2026-07-10 | Destination charges on Connect accounts         | Stylist receives deposit; platform not fund custodian     |
| 2026-07-10 | Claude provider abstraction (live + mock)       | Local dev + deterministic test harness                    |
| 2026-07-10 | Ch.17 dashboard MVP (17.1–17.3)                 | Week calendar + escalation-first home; real-time deferred |

## Technical debt

| Item                        | Chapter | Notes      |
| --------------------------- | ------- | ---------- |
| Google Calendar sync        | 8.2 V2  | Not in MVP |
| Calendar reconciliation     | 8.4 V2  | Not in MVP |
| Refund/forfeiture on cancel | 9.3 V2  | Not in MVP |
| Payout scheduling           | 9.5 V2  | Not in MVP |

## Blockers

| Item | Status |
| ---- | ------ |
| —    | —      |
