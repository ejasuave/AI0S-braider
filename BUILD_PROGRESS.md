# Build Progress — Project Braids

**Started:** 2026-07-10  
**Objective:** Production-quality MVP per Product Blueprint + Prompt Library Back Matter  
**Current milestone:** MVP handbook complete (Ch.1–25). Beta ship per Back Matter checklist.

---

## Web UI (Ch.1–9 + beta directory)

Mobile-first Next.js app at `apps/web` — tokens from `reference/design/visual-identity-and-ux.md`.

| Route                                     | Purpose                                                            |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `/`                                       | Landing — stylist / client entry                                   |
| `/login`, `/register/*`, `/verify`        | Auth (email+password stylists; phone OTP all)                      |
| `/stylist`                                | Dashboard — **escalations first**, today's bookings, shortcuts     |
| `/stylist/bookings`                       | Week calendar + approval toggle + pending holds (Ch.17.2)          |
| `/stylist/reviews`                        | Reviews stub (Ch.10 backend; full UI later)                        |
| `/stylist/calendar`                       | Google sync, buffer, **conflict resolve** (Ch.17.2)                |
| `/client/profile`                         | Display name + email (Ch.17.4)                                     |
| `/client/saved-stylists`                  | Saved favourites + remove (Ch.17.4)                                |
| `/client/bookings`                        | Upcoming / past / cancelled filters (Ch.17.4)                      |
| `/stylist/inbox`                          | Escalated + all SMS conversations                                  |
| `/stylist/staff`                          | Team — invite staff, view permissions (Ch.4.3)                     |
| `/stylist/services`                       | Structured pricing taxonomy (Ch.6.4)                               |
| `/stylist/portfolio`                      | Portfolio upload via pre-signed URLs (Ch.6.2)                      |
| `/stylist/hours`                          | Working hours configuration (Ch.6.6)                               |
| `/stylist/policy`                         | Deposit and cancellation policy (Ch.6.5)                           |
| `/stylist/profile`                        | Business profile + onboarding (Ch.6.1)                             |
| `/client`                                 | Client home, bookings, inbox link, **sign out**                    |
| `/client/inbox`, `/client/inbox/[id]`     | Client SMS conversation history (Ch.11.1)                          |
| `/client/notifications`                   | Reminder + marketing preferences (Ch.5.4 / Ch.12)                  |
| `/directory`, `/directory/[stylistId]`    | **Beta** public stylist search (opt-in)                            |
| `/book?stylistId=&serviceOfferingId=`     | Public booking link → hold → deposit                               |
| `/stylist/{slug}/{style}/{size}/{length}` | Vanity share path → redirects to `/book?…` (UUID links still work) |
| `/status`                                 | API / DB health (dev)                                              |

---

## Completed chapters

| Chapter                          | Status   | Notes                                                                                                     |
| -------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| 1 — Project Setup                | Complete | `aba627c`                                                                                                 |
| 2 — Architecture                 | Complete | `13b6544`                                                                                                 |
| 3 — Authentication               | Complete | `921b99f`                                                                                                 |
| 4 — User Roles (4.1–4.4)         | Complete | businesses, staff API, guards, impersonation, `/stylist/staff`                                            |
| 6 — Stylist Features (6.1–6.6)   | Complete | `/businesses/me/*`, policies, hours, Instagram, portfolio                                                 |
| 7 — Booking Engine               | Complete | State machine, holds, policy cancel, manual bookings, calendar conflicts — aligned to Ch.7 prompt library |
| 8 — Calendar (8.1–8.4)           | Complete | Calendar module, public availability, Google sync, reconcile job                                          |
| 9 — Payments (9.1–9.6)           | Complete | Connect, deposits, refunds, payouts, disputes, webhook hardening                                          |
| 11 — Messaging (11.1–11.2, 11.5) | Complete | Conversations schema, Twilio SMS, stylist handoff                                                         |
| 13 — AI Receptionist (13.1–13.8) | Complete | Claude structured turns, escalation, booking dispatch, tests                                              |
| 12 — Notifications (12.1–12.4)   | Complete | Schema, reminder worker, confirmation/cancel notices, STOP compliance                                     |
| Beta directory                   | Complete | Opt-in `directory_visible`, search API, `/directory` web UI (Ch.16 deferred)                              |
| 17 — Dashboards (17.1–17.5)      | Complete | Permissions nav, approval mode, SSE realtime, client dashboard, conflict resolve                          |
| 23 — Deployment (23.1–23.4)      | Complete | CI/CD, staging/prod workflows, ops-status, kill switch, migration safety                                  |
| 24 — Mobile (24.1)               | Complete | Layout audit, 5-tab nav, calendar/inbox fixes — [MOBILE_AUDIT.md](docs/MOBILE_AUDIT.md)                   |
| 25 — Future Features             | Complete | Deferred-feature registry — [FUTURE_FEATURES.md](docs/FUTURE_FEATURES.md) (docs only)                     |

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

### Chapter 6 deliverables (aligned to prompt library)

| Prompt | Deliverable                                                                                   |
| ------ | --------------------------------------------------------------------------------------------- |
| 6.1    | Extended `businesses`, `POST/GET/PATCH /businesses/me`, onboarding gate, `can_manage_profile` |
| 6.2    | Pre-signed portfolio upload, register/reorder/delete, 50-item limit                           |
| 6.3    | Instagram connect/import, encrypted tokens, refresh job, `INSTAGRAM_ACCOUNT_INELIGIBLE`       |
| 6.4    | Seeded `style_categories`, `service_offerings` with category FK, public `/style-categories`   |
| 6.5    | `business_policies` defaults (20% deposit), `getBusinessPolicy` for Ch.7/9                    |
| 6.6    | `working_hours`, `schedule_exceptions`, `getBaseAvailabilityRules` for Ch.8                   |

### Chapter 4 deliverables (aligned to prompt library)

| Prompt | Deliverable                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| 4.1    | `businesses`, `business_staff`, shared types, `permissions.test.ts`, ARCHITECTURE Roles module             |
| 4.2    | `requireRole`, `requireBusinessPermission`, `permission_denied` logs, access demo routes, `guards.test.ts` |
| 4.3    | Staff invite/accept/update/remove/list APIs, Zod strict permission flags, lifecycle integration tests      |
| 4.4    | `impersonation_sessions`, admin impersonate start/end, 5-min `imp` tokens, denylist + audit logs           |

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

### Chapter 17 deliverables (aligned to prompt library)

| Prompt | Deliverable                                                                                                        |
| ------ | ------------------------------------------------------------------------------------------------------------------ |
| 17.1   | Permission-aware bottom nav + More links; session refresh before login redirect; `/stylist/reviews` stub           |
| 17.2   | Week calendar status dots; approval toggle + `POST /bookings/:id/approve`; calendar conflict resolve UI            |
| 17.3   | Escalation reason labels; inbox SSE on open thread; inline style-recognition placeholder (Ch.14 deferred)          |
| 17.4   | Client bookings segment filters; `/client/profile`; `/client/saved-stylists`; `client_profiles`, `saved_stylists`  |
| 17.5   | SSE `GET /realtime/stylist/events`; `useStylistRealtime` + reconciliation refetch; [REALTIME.md](docs/REALTIME.md) |

### Beta directory (founder override — pre-Ch.17)

| Deliverable                               | Notes                                                      |
| ----------------------------------------- | ---------------------------------------------------------- |
| `directory_visible` on `stylist_profiles` | Default false; opt-in only                                 |
| `GET /api/v1/directory/stylists`          | Filter by q, location, style; paginated (max 50)           |
| `GET /api/v1/directory/stylists/:id`      | Public card + services → existing `/book` flow             |
| Web `/directory`                          | Search + profile pages; stylist toggle on profile settings |

Full Ch.16 (search index, availability ranking, scrape protection) remains Phase 2.

### Chapter 12 deliverables (aligned to prompt library)

| Prompt | Deliverable                                                                                                                                           |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 12.1   | `notifications` schema (`skip_reason`, nullable `booking_id`), `generateNotificationContent`, deliver worker with preference + status checks          |
| 12.2   | Event-driven 48h/2h reminder scheduling; short lead-time skip; cancel on booking cancellation                                                         |
| 12.3   | Dual confirmation/cancel notices; stylist-only no-show; transactional bypass of marketing preference                                                  |
| 12.4   | Ch.5 `notification_preferences`, `opt_out_audit_log`, STOP e2e chain, `docs/COMPLIANCE.md`                                                            |
| 5.4    | `client-preferences` module — `handleStopKeyword`/`handleStartKeyword`, `GET/PATCH /clients/me/notification-preferences`, web `/client/notifications` |

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

### Chapter 9 deliverables

| Prompt | Deliverable                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| 9.1    | `payment_accounts`, `POST/GET /businesses/me/stripe/*`, `isPaymentReady` gate on holds                            |
| 9.2    | `createDepositCharge`, `POST /bookings/:bookingId/deposit`, capture webhook → `confirmBooking`                    |
| 9.3    | `processRefund` (full/partial/forfeit), domain events from cancel/no-show, partial-refund endpoint                |
| 9.4    | Webhook hardening tests, out-of-order protection, `src/scripts/reconcile-payments.ts`                             |
| 9.5    | `GET /businesses/me/payouts` (Stripe-sourced), `GET /businesses/me/income-report`, `docs/BUSINESS_MODEL_NOTES.md` |
| 9.6    | `policy_snapshot` on bookings, `dispute_evidence_packages`, `charge.dispute.created` handler                      |

Frontend: `/stylist/payments` — Connect, income summary, payout history.

### Chapter 8 deliverables

| Prompt | Deliverable                                                                      |
| ------ | -------------------------------------------------------------------------------- |
| 8.1    | `GET /api/v1/businesses/:businessId/availability` — public slot engine           |
| 8.2    | Google Calendar connect, push/delete, inbound webhook, `external_calendar_links` |
| 8.3    | `buffer_minutes` (default 15), padded slot generation                            |
| 8.4    | `calendar.reconcile` job every 30 minutes                                        |

Frontend: `/stylist/calendar`, public slots on `/book` before sign-in.

## Pending chapters (MVP critical path)

| Chapter | Name         | Status   |
| ------- | ------------ | -------- |
| —       | MVP handbook | Complete |

## Stylist feedback batch (2026-07-20)

Service & booking improvements from pilot stylist feedback (not a numbered chapter):

- Hierarchical style taxonomy + **Bum Length** tier
- Hours+minutes duration UI (stored as total minutes)
- Requirements / add-ons catalogs; expanded remaining-balance methods (7)
- Vanity share URLs + Google Reviews **placeholder** fields ([docs/GOOGLE_REVIEWS.md](docs/GOOGLE_REVIEWS.md))
- Enriched public booking payload + AI receptionist context (policy, requirements, add-ons)

**Next:** Staging deploy + external wiring (Stripe/Twilio/Google webhooks) per [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) § Production readiness, then pilot onboarding.

### Pre-pilot local gates (2026-07-12)

| Gate                        | Status                                                          |
| --------------------------- | --------------------------------------------------------------- |
| `pnpm test`                 | 190/190 API tests + web suites pass                             |
| `pnpm lint`                 | Pass (3 pre-existing warnings, 0 errors)                        |
| `pnpm typecheck`            | Pass                                                            |
| `pnpm format:check`         | Pass                                                            |
| `pnpm build`                | Pass                                                            |
| `pnpm ops:check-migrations` | Pass — Ch.9 drop reviewed + allowlisted                         |
| Kill-switch drill (local)   | `killSwitchActive` flips with `AI_RECEPTIONIST_ENABLED`         |
| Google Calendar sync        | Live mode verified end to end (connect + ops-status hang fixed) |

## Architectural decisions

| Date       | Decision                                        | Rationale                                                 |
| ---------- | ----------------------------------------------- | --------------------------------------------------------- |
| 2026-07-10 | Availability in `calendar` module (Ch.8)        | Public endpoint + Google sync; booking delegates reads    |
| 2026-07-10 | `Europe/London` default timezone                | UK-only MVP per Blueprint                                 |
| 2026-07-10 | Client holds validate against generated slots   | Ties Ch.8 to Ch.7 hold creation                           |
| 2026-07-10 | Manual stylist bookings skip availability check | Walk-in / off-platform blocks per Playbook                |
| 2026-07-10 | `StripeProvider` abstraction (live + mock)      | Local dev without Stripe keys; test-mode when configured  |
| 2026-07-10 | Destination charges on Connect accounts         | Stylist receives deposit; platform not fund custodian     |
| 2026-07-10 | Claude provider abstraction (live + mock)       | Local dev + deterministic test harness                    |
| 2026-07-10 | Ch.17 dashboard MVP (17.1–17.3)                 | Week calendar + escalation-first home; real-time deferred |

## Technical debt

| Item              | Chapter | Notes                                          |
| ----------------- | ------- | ---------------------------------------------- |
| Payout scheduling | 9.5 V2  | Stripe-managed payouts only; custom UI not MVP |

Resolved since first draft: Google Calendar sync (live `RealGoogleCalendarApiClient`, Ch.8.2),
calendar reconciliation job (Ch.8.4), refund/forfeiture on cancel (Ch.9.3).

## Blockers

| Item | Status |
| ---- | ------ |
| —    | —      |
