# Chapter 2 — Architecture

## Overview

This chapter translates the service-boundary design from the Engineering Playbook (Identity, Stylist Profile, Booking Engine, AI Receptionist, Payments, Notifications, Directory as distinct services with defined ownership) into concrete instructions the AI must follow whenever it builds any feature in later chapters. Where Chapter 1 set up tooling, this chapter sets up the architectural rules of the road: how API layers are structured, how the frontend and backend share types, how background jobs run, and how webhooks/events are handled safely. No feature-specific schema or business logic is introduced here — that begins in Chapter 3.

## Why This Chapter Exists

Without an explicit architectural contract established up front, an AI assistant working chapter-by-chapter across many sessions will tend to reinvent patterns — sometimes calling the database directly from a route handler, sometimes going through a service layer, sometimes not validating webhook signatures consistently. This chapter exists to give every later prompt a single, unambiguous architectural pattern to reference, so "following the established architecture" means the same thing in Chapter 13 (AI Receptionist) as it does in Chapter 9 (Payments).

## Prompts in This Chapter

2.1 Define service boundary documentation the AI must respect
2.2 Establish API layer conventions
2.3 Establish shared type/schema conventions between frontend and backend
2.4 Define the internal API gateway/BFF pattern
2.5 Set up background job/worker infrastructure
2.6 Establish event/webhook handling conventions

---

### Prompt 2.1 — Define Service Boundary Documentation the AI Must Respect

**Category:** Architecture — Foundational Contract
**Objective:** Produce a single architectural reference document, `ARCHITECTURE.md`, defining each logical service in the platform (Identity, Stylist Profile, Booking Engine, AI Receptionist, Payments, Notifications, Directory) and what each one owns and does not own — and require every future feature prompt to be checked against this document before implementation.

**Context:** Requires Chapter 1 complete (module conventions from Prompt 1.6 in particular, since service boundaries will map onto the `src/modules/<feature>` structure already established). This prompt is documentation-and-convention-setting; it does not write feature code.

**Prompt:**

```
Create an ARCHITECTURE.md file at the repository root documenting the platform's service boundaries. This is a reference document, not a coding task — do not implement any of the services described.

Document the following services, each with a clear "owns" and "does not own" list:
- Identity — owns authentication, sessions, roles; does not own profile content
- Stylist Profile — owns bio, portfolio, pricing, policies; does not own availability computation
- Booking Engine — owns slot holds, confirmations, cancellations, the booking state machine; does not own payment capture
- AI Receptionist — owns conversation state, intent resolution, style/price lookup coordination; does not own the calendar source of truth
- Payments — owns deposit capture, refunds, payout scheduling; does not own pricing decisions
- Notifications — owns delivery of reminders and confirmations; does not own message content generation logic (delegates that to the Receptionist's content layer)
- Directory — owns search and public profile rendering; does not own booking state

For each service, also document:
- Which src/modules/<feature> folder(s) (established in Chapter 1) implement it
- Which other services it is allowed to call directly, and which it must never call directly (e.g., the AI Receptionist should call the Booking Engine's service layer, never query booking tables directly)

Add a section at the top of ARCHITECTURE.md stating: "Every feature prompt executed in this codebase must be checked against this document. If a prompt would require one service to reach into another service's owned data or logic directly, flag this conflict before proceeding rather than implementing it silently."

Do not write any application code in this prompt.
```

**Expected Output:** A complete `ARCHITECTURE.md` at the repository root with the service table described, folder mappings, and the explicit instruction for future sessions to check new work against it.

**Success Criteria:**

- Every service listed has both an "owns" and "does not own" section
- The document explicitly cross-references the Chapter 1 module folder structure
- A later prompt (e.g., in Chapter 13) can simply say "respect the boundaries in ARCHITECTURE.md" and get correct behavior without re-explaining the rules

**Dependencies:** Prompt 1.6

---

### Prompt 2.2 — Establish API Layer Conventions

**Category:** Architecture — API Design
**Objective:** Define the request/response conventions, error format, versioning strategy, and route-naming pattern that every API endpoint built in every later chapter will follow.

**Context:** Requires Prompt 2.1 (service boundaries must be defined before API conventions are layered on top of them) and Chapter 1's CI/tooling setup.

**Prompt:**

```
Establish the API layer conventions for apps/api that all future endpoints must follow.

Requirements:
- Define a consistent success response envelope, e.g., { data: <payload>, meta?: <pagination or extra info> }
- Define a consistent error response envelope, e.g., { error: { code: string, message: string, details?: object } }, with a documented list of standard error codes (VALIDATION_ERROR, NOT_FOUND, UNAUTHORIZED, FORBIDDEN, CONFLICT, RATE_LIMITED, INTERNAL_ERROR) that every endpoint must use rather than inventing ad hoc error shapes
- Define the route naming and versioning convention, e.g., /api/v1/<resource>, with a documented policy for how a breaking change to a resource introduces /api/v2/<resource> rather than mutating v1's behavior
- Define the standard middleware chain every route passes through in order: request ID assignment, structured logging (from Chapter 1), authentication, role/permission check, input validation (Zod schema per route), rate limiting where applicable, handler execution, error-handling middleware
- Every route handler must validate its input against a Zod schema before any business logic executes, and must return the standard error envelope with VALIDATION_ERROR and field-level details on failure
- Document all of this in a new file, docs/API_CONVENTIONS.md, and update ARCHITECTURE.md to reference it

Implement one example endpoint (a trivial GET /api/v1/ping that returns { data: { status: "ok" } }) end to end through the full middleware chain, purely to prove the convention works — this is not a real feature.
```

**Expected Output:** `docs/API_CONVENTIONS.md` documenting response envelopes, error codes, versioning, and middleware chain; a working example `/api/v1/ping` endpoint demonstrating the full chain; `ARCHITECTURE.md` updated to reference the new document.

**Success Criteria:**

- `GET /api/v1/ping` returns the documented success envelope
- Sending malformed input to a route with a Zod schema (can be tested via the ping endpoint extended with a dummy query param requirement, or a temporary test route) returns the documented VALIDATION_ERROR envelope with field-level detail
- All standard error codes are documented with a one-line description of when each applies

**Dependencies:** Prompt 2.1, Chapter 1 (CI and logging)

---

### Prompt 2.3 — Establish Shared Type/Schema Conventions Between Frontend and Backend

**Category:** Architecture — Type Safety
**Objective:** Ensure that data shapes (e.g., a booking object, a user role enum) are defined exactly once in `packages/shared-types` and imported by both `apps/web` and `apps/api`, eliminating an entire class of bugs where frontend and backend silently drift out of sync over the life of a multi-year project.

**Context:** Requires Prompt 1.1 (packages/shared-types already exists as an empty package) and Prompt 2.2 (API response envelope conventions must exist before shared types can model them).

**Prompt:**

```
Establish the pattern for shared types and validation schemas in packages/shared-types, to be used by both apps/web and apps/api for the rest of the project's life.

Requirements:
- Use Zod as the single source of truth for each shared data shape: define a Zod schema, then derive the TypeScript type from it (z.infer), rather than maintaining separate manually-written types and validation schemas that can drift apart
- Establish the folder convention within packages/shared-types, e.g., src/schemas/<domain>.ts (one file per domain area — user, booking, payment, etc. — to be populated as those domains are built in later chapters)
- Both apps/web and apps/api must import types from this package rather than redefining them locally — document this rule clearly
- Set up the package's build/export configuration so it can be consumed by both a Next.js frontend and a Node backend without module resolution issues
- As a proof of concept (not a real feature), define one example shared schema — a generic PaginationParams schema (page, pageSize, with sensible defaults and max limits) — since pagination will be needed by nearly every list-returning endpoint in later chapters, and import and use it from both a dummy apps/api route and a dummy apps/web data-fetching hook

Document this convention in docs/API_CONVENTIONS.md (extending the file from the previous prompt) with a short worked example showing the anti-pattern (duplicated type definitions) versus the correct pattern (shared Zod-derived type).
```

**Expected Output:** A working `packages/shared-types` package exporting Zod-derived types, correctly consumable from both apps; a documented `PaginationParams` example used in both a backend route and a frontend hook; updated documentation with the anti-pattern/correct-pattern comparison.

**Success Criteria:**

- `apps/api` and `apps/web` both successfully import and use `PaginationParams` from `packages/shared-types` with no type errors
- Changing a field in the shared schema and re-running typecheck causes both apps to surface a type error wherever they relied on the old shape — proving the drift-prevention actually works
- Documentation clearly shows the anti-pattern being avoided

**Dependencies:** Prompts 1.1, 2.2

---

### Prompt 2.4 — Define the Internal API Gateway/BFF Pattern

**Category:** Architecture — Frontend/Backend Integration
**Objective:** Decide and document how `apps/web` communicates with `apps/api` — directly, or through a Backend-for-Frontend (BFF) layer — and establish the data-fetching convention (e.g., React Query/TanStack Query) the frontend will use for every feature in later chapters.

**Context:** Requires Prompts 2.2 and 2.3. This prompt determines a pattern that every frontend feature prompt in Chapters 5 onward will assume exists.

**Prompt:**

```
Establish the frontend-to-backend communication pattern for this project.

Decision to implement: apps/web calls apps/api directly over HTTPS using a typed API client, without an intermediate BFF layer, since the team is small and an additional service adds operational overhead without a corresponding benefit at this stage. (If the team later needs request aggregation or response shaping specific to a device type, a BFF can be introduced without breaking this convention, since the typed client isolates the actual fetch calls in one place.)

Requirements:
- Create a typed API client in apps/web (e.g., in src/shared/lib/api-client.ts) that wraps fetch calls, automatically attaches auth tokens, parses the standard response/error envelope from Prompt 2.2, and throws typed errors the UI layer can catch and handle consistently
- Integrate TanStack Query (React Query) for all data-fetching in apps/web, with a documented convention for query key structure (e.g., ['bookings', stylistId, filters]) so cache invalidation is predictable as features are added over time
- Document the rule: no component should call fetch directly — all data access goes through the typed API client and TanStack Query hooks
- As a proof of concept, wire up the /api/v1/ping endpoint from Prompt 2.2 through this full stack: typed client call, wrapped in a TanStack Query hook, rendered in a trivial placeholder page

Document this pattern in docs/API_CONVENTIONS.md.
```

**Expected Output:** A working typed API client, TanStack Query integration with a documented query-key convention, and a working end-to-end example (ping endpoint → typed client → query hook → rendered UI).

**Success Criteria:**

- The example page successfully displays data fetched through the full documented chain
- A simulated auth failure (e.g., an expired token) is caught by the typed client and surfaces a typed error the UI can branch on, not an unhandled exception
- Documentation clearly states the "no direct fetch calls in components" rule

**Dependencies:** Prompts 2.2, 2.3

---

### Prompt 2.5 — Set Up Background Job/Worker Infrastructure

**Category:** Architecture — Asynchronous Processing
**Objective:** Establish the background job queue infrastructure that later chapters will depend on for time-based work — slot-hold expiry (Chapter 7), reminder scheduling (Chapter 12), calendar reconciliation (Chapter 8), and any AI-related batch/evaluation jobs (Chapters 13-14).

**Context:** Requires Chapter 1's Redis service (added in Prompt 1.7's Docker Compose configuration in anticipation of this exact need) and Prompt 2.1 (service boundaries, since job definitions should live within the module that owns them, not in a separate ungoverned "jobs" dumping ground).

**Prompt:**

```
Set up background job/worker infrastructure for apps/api using BullMQ backed by the Redis instance already configured in the local Docker Compose environment.

Requirements:
- Create a shared job-queue setup module in src/shared/queue/ that other modules use to define and enqueue jobs — do not let each feature module reinvent its own queue connection
- Establish the convention that job definitions live within their owning feature module (e.g., a future "slot-hold-expiry" job lives in src/modules/booking/jobs/, not in a generic jobs folder), consistent with ARCHITECTURE.md's ownership rules
- Implement one example recurring job as a proof of concept: a heartbeat job that runs every minute and writes a structured log line (using the logging convention from Chapter 1) — this is not a real feature, purely a working example of the pattern
- Implement one example on-demand (enqueued, not scheduled) job as a proof of concept: a job that accepts a string payload and logs it after a configurable delay, demonstrating the enqueue-with-delay pattern that will later be used for reminder scheduling
- Set up a separate worker process entry point (e.g., apps/api can run in "server" mode or "worker" mode based on a startup flag or a separate script) so job processing can be scaled independently of the API server in production
- Document the pattern, including how to define a new recurring vs. on-demand job, in docs/API_CONVENTIONS.md or a new docs/BACKGROUND_JOBS.md

Verify by starting the worker process locally and confirming both the recurring heartbeat and an enqueued delayed job execute and log correctly.
```

**Expected Output:** A working BullMQ setup connected to local Redis, a documented convention for where job definitions live, two working proof-of-concept jobs (recurring and on-demand-delayed), and a separately runnable worker process.

**Success Criteria:**

- The heartbeat job produces a log line approximately every 60 seconds when the worker process is running
- Enqueuing the delayed example job causes it to execute and log after the configured delay, not immediately
- Documentation clearly explains where a new job should be defined and how to enqueue one from within a feature module

**Dependencies:** Prompt 2.1, Chapter 1 (Docker Compose/Redis)

---

### Prompt 2.6 — Establish Event/Webhook Handling Conventions

**Category:** Architecture — Reliability
**Objective:** Define the idempotency and signature-verification pattern that every future webhook consumer (Stripe in Chapter 9, potentially Twilio/Meta delivery-status callbacks in Chapters 11-12) must follow, since this is one of the highest-risk categories of bug if handled inconsistently across chapters.

**Context:** Requires Prompt 1.4 (database must exist to store processed-event records) and Prompt 2.2 (API conventions, since webhook endpoints are still API routes and should follow the same middleware/error conventions where applicable, with documented exceptions for signature verification).

**Prompt:**

```
Establish the platform-wide convention for handling inbound webhooks from third-party providers (Stripe, and later potentially Twilio/Meta), to be followed by every webhook integration built in later chapters.

Requirements:
- Define a generic processed_webhook_events table (or equivalent) with columns for provider name, provider_event_id, processed_at, and a unique constraint on (provider, provider_event_id) — this is a shared, cross-cutting table, not owned by any single feature module, and should be documented as such in ARCHITECTURE.md
- Establish the required handling sequence for every webhook endpoint, to be followed exactly in every future implementation: (1) verify the provider's cryptographic signature before parsing the payload at all, reject immediately with no further processing if invalid; (2) check whether provider_event_id already exists in processed_webhook_events, and if so, return success immediately without reprocessing (idempotency); (3) process the event's business logic; (4) record the event as processed only after business logic succeeds, so a crash mid-processing results in a safe retry rather than a false "already processed" record
- Webhook endpoints must be exempt from any general-purpose authentication middleware (since the caller is a third party, not a logged-in user) but must never be exempt from signature verification
- Document this entire sequence, with the specific rationale for the ordering (especially "why signature verification always happens first" and "why the processed record is written last, after success"), in a new file docs/WEBHOOK_CONVENTIONS.md
- Implement no real webhook integration in this prompt — Stripe's specific webhook handler is built in Chapter 9. This prompt only creates the shared table, the documented sequence, and a reusable middleware/utility function (e.g., a verifyAndDeduplicateWebhook helper) that Chapter 9's prompts will be instructed to use

Write a unit test for the deduplication utility function proving that a repeated provider_event_id is correctly short-circuited without re-executing a passed-in processing callback.
```

**Expected Output:** A shared `processed_webhook_events` table/migration, `docs/WEBHOOK_CONVENTIONS.md` documenting the required sequence and its rationale, a reusable deduplication/verification utility function, and a passing unit test proving idempotent behavior.

**Success Criteria:**

- The unit test demonstrates that calling the utility twice with the same `provider_event_id` results in the processing callback executing only once
- Documentation explicitly states the four-step sequence and explains why signature verification must precede idempotency checking (to avoid an attacker being able to probe which event IDs have already been processed)
- No actual Stripe/Twilio integration code exists yet — confirmed this prompt stayed scoped to shared infrastructure only

**Dependencies:** Prompts 1.4, 2.2

---

## Chapter 2 Summary

At the end of this chapter, the codebase has a documented architectural contract (`ARCHITECTURE.md`), consistent API request/response/error conventions, a single source of truth for shared types between frontend and backend, a settled frontend data-fetching pattern, working background job infrastructure, and a battle-tested webhook idempotency pattern ready for Chapter 9 to use. No feature-specific business logic exists yet.

**Every prompt from Chapter 3 onward should explicitly reference this chapter's documents** (`ARCHITECTURE.md`, `docs/API_CONVENTIONS.md`, `docs/BACKGROUND_JOBS.md`, `docs/WEBHOOK_CONVENTIONS.md`) rather than re-deriving these patterns. If a future chapter's prompt seems to require deviating from one of these conventions, treat that as a signal to pause and reconsider the convention deliberately, rather than letting one feature quietly drift from the rest of the codebase.

---

Ready to proceed to Chapter 3 (Authentication) when you are.
