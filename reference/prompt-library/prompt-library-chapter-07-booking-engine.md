# Chapter 7 — Booking Engine

## Overview

This chapter implements the core transactional system of the platform: the booking state machine, slot holds with TTL expiry, confirmation, cancellation and no-show handling, manual/dashboard-created bookings, and conflict detection. This is the system every other chapter's booking-related logic ultimately calls into — Chapter 5's client booking history reads from it, Chapter 9's payments trigger its state transitions, Chapter 13's AI Receptionist creates holds through it, and Chapter 17's dashboard displays and manages it directly. Per `ARCHITECTURE.md`, the Booking Engine owns holds, confirmations, cancellations, and the state machine itself — it does not own payment capture, which remains Payments' domain.

## Why This Chapter Exists

A booking system with race conditions or inconsistent state transitions is worse than no booking system at all — it actively damages trust by double-booking a stylist's time or leaving payment and calendar state out of sync. This chapter exists to build that core transactional logic once, carefully, with explicit concurrency handling and idempotent state transitions, so that every later chapter calling into it inherits correctness rather than needing to reason about booking race conditions itself.

## Prompts in This Chapter

7.1 Booking state machine implementation
7.2 Slot hold creation with TTL expiry
7.3 Booking confirmation flow
7.4 Cancellation and no-show handling
7.5 Manual/dashboard-created bookings
7.6 Booking conflict detection and resolution

---

### Prompt 7.1 — Booking State Machine Implementation

**Category:** Booking Engine — Foundation
**Objective:** Create the `bookings` table and the state machine logic (`held → confirmed → completed | cancelled | no_show`) that every subsequent prompt in this chapter builds on, following the schema specified in the Engineering Playbook.

**Context:** Requires Chapter 6 (`service_offerings` for duration/pricing reference, `business_policies` for deposit/cancellation rules) and Chapter 5 (client accounts to reference). This is the foundational prompt for the entire Booking Engine module.

**Prompt:**

```
Implement the core booking state machine in a new src/modules/booking-engine/ module (update ARCHITECTURE.md: owns slots, holds, confirmations, cancellations, the booking state machine; does not own payment capture, which is Payments' domain; other modules must call this module's service layer to read or affect booking state, never query its tables directly).

Requirements:
- Add a bookings table: id, stylist_id (FK to businesses), client_id (FK to users), service_offering_id (FK to service_offerings from Chapter 6), status (enum: held, confirmed, completed, cancelled, no_show), start_time (timestamptz), end_time (timestamptz, derived from service duration plus any configured buffer), deposit_amount (numeric), deposit_status (enum: pending, paid, refunded, forfeited), hold_expires_at (timestamptz, nullable — null once confirmed), source (enum: ai_agent, dashboard_manual, client_direct), created_at, cancelled_at (nullable), cancellation_reason (text, nullable)
- Implement the state machine as an explicit, centralized function (e.g., transitionBookingStatus(bookingId, fromStatus, toStatus)) that validates the transition is legal (e.g., held → confirmed is legal; confirmed → held is not) before applying it, rather than allowing any code path to set status directly via a generic update call — this centralization is what every later prompt in this chapter and every other chapter's booking-state interaction must go through
- Define the complete legal-transition table explicitly in code and as a diagram in a new docs/BOOKING_STATE_MACHINE.md: held → confirmed, held → cancelled (hold expiry or explicit cancellation before payment), confirmed → completed, confirmed → cancelled, confirmed → no_show; no other transitions are legal
- Implement GET /api/v1/bookings/:bookingId (internal-service-oriented for now — guarded appropriately, reusable by Chapters 5, 9, 13, 17) returning a single booking's full state
- Write unit tests for the state machine covering every legal transition succeeding and a representative sample of illegal transitions (e.g., completed → held) being rejected with a clear error, not a silent no-op

Do not implement hold creation, confirmation triggers, or cancellation business logic yet — those are separate prompts. This prompt is the schema and the transition-validation engine only.
```

**Expected Output:** A `bookings` table, a centralized, validated state-transition function, a documented state diagram, a basic single-booking read endpoint, and passing unit tests covering legal and illegal transitions.

**Success Criteria:**

- Every legal transition listed in `docs/BOOKING_STATE_MACHINE.md` succeeds when tested
- At least one illegal transition (e.g., `completed → confirmed`) is rejected with a clear, specific error rather than silently succeeding or throwing a generic database error
- No code path outside the centralized transition function directly sets a `bookings.status` value — confirmed by code review

**Dependencies:** Chapter 5, Chapter 6

---

### Prompt 7.2 — Slot Hold Creation with TTL Expiry

**Category:** Booking Engine — Holds
**Objective:** Implement the ability to create a temporary, time-limited hold on a slot while a client completes deposit payment, with automatic release if the hold expires unpaid, using the background job infrastructure from Chapter 2.

**Context:** Requires Prompt 7.1 (state machine) and Chapter 2 (background jobs). This is one of the most concurrency-sensitive prompts in the library — two clients must never be able to simultaneously hold the same slot.

**Prompt:**

```
Implement slot hold creation and TTL-based expiry in src/modules/booking-engine/.

Requirements:
- Implement a createHold(stylistId, clientId, serviceOfferingId, startTime) service function that: computes end_time from the service offering's estimated_duration_minutes plus any configured buffer, checks for conflicting existing held/confirmed bookings for that stylist in the requested time range, and if no conflict exists, creates a bookings row with status: held and hold_expires_at set 15 minutes from now
- Enforce the no-double-hold guarantee using a database-level mechanism, not just an application-level check-then-write (which is vulnerable to a race condition between two simultaneous requests) — use a unique constraint or an explicit row-level lock (e.g., SELECT ... FOR UPDATE within a transaction scoped to the stylist's relevant time range, or a unique constraint on a computed slot-identity column) so that a second simultaneous hold attempt for the same slot fails at the database layer rather than relying on application-level timing
- Implement a recurring background job (using Chapter 2's job infrastructure), e.g., running every minute, that finds all held bookings with hold_expires_at in the past and transitions them to cancelled via the centralized state-machine function from Prompt 7.1, with cancellation_reason: 'hold_expired'
- Implement POST /api/v1/bookings/hold as the externally-callable endpoint wrapping createHold, to be called by the AI Receptionist (Chapter 13) and eventually the dashboard (Chapter 17) — guarded appropriately for each caller type
- Write a concurrency-focused integration test: fire two simultaneous hold requests for the exact same stylist/time-range and assert that exactly one succeeds and the other receives a clear SLOT_UNAVAILABLE error, not a race-condition-induced double booking
- Write a test for the expiry job: create a held booking with an already-past hold_expires_at, run the expiry job, and confirm it transitions to cancelled with the correct reason
```

**Expected Output:** A concurrency-safe `createHold` function, a database-level mechanism preventing simultaneous double-holds, a recurring expiry background job, an external hold-creation endpoint, and passing tests including the critical concurrency test.

**Success Criteria:**

- The concurrency test demonstrates that of two simultaneous hold requests for the same slot, exactly one succeeds
- A held booking past its `hold_expires_at` is correctly transitioned to `cancelled` (with `cancellation_reason: 'hold_expired'`) by the recurring job
- The double-hold prevention is confirmed to rely on a database-level guarantee, not solely application-level timing, per code review

**Dependencies:** Prompt 7.1, Chapter 2 (background jobs)

---

### Prompt 7.3 — Booking Confirmation Flow

**Category:** Booking Engine — Confirmation
**Objective:** Implement the transition from `held` to `confirmed`, triggered by successful deposit payment, and the subsequent push of the confirmed appointment to the stylist's external calendar.

**Context:** Requires Prompt 7.2. This prompt is triggered by Chapter 9's payment webhook handling — implement the Booking Engine's side of that integration now, with a clearly documented interface Chapter 9 will call, even though Chapter 9's actual Stripe integration doesn't exist yet.

**Prompt:**

```
Implement the booking confirmation flow in src/modules/booking-engine/.

Requirements:
- Implement a confirmBooking(bookingId) service function that: validates the booking is currently held and not expired, transitions it to confirmed via the Prompt 7.1 state machine function, clears hold_expires_at, and enqueues (using Chapter 2's job infrastructure) a job to push the confirmed appointment to the stylist's external calendar (the actual Google Calendar push implementation belongs to Chapter 8 — this prompt should define and call a clearly named interface, e.g., a pushToExternalCalendar(bookingId) function stubbed with a TODO referencing Chapter 8, so the confirmation flow's shape is correct even before Chapter 8 exists)
- This confirmBooking function is the documented integration point Chapter 9's Stripe webhook handler will call upon successful deposit capture — document this clearly in docs/BOOKING_STATE_MACHINE.md or a new docs/PAYMENTS_INTEGRATION.md, including the expected call signature, so Chapter 9 can be built against a stable contract
- Handle the edge case where confirmBooking is called for a booking whose hold has already expired (a race between the expiry job and a late-arriving payment webhook) — in this case, the booking should NOT be confirmed, and the function should return a specific error/result indicating the hold expired, which the eventual Chapter 9 payment handler must use to trigger a refund of the payment that was just captured (document this as a critical cross-chapter requirement, since a captured payment for an expired hold must never be silently kept without either confirming the booking or refunding the client)
- Implement idempotency: calling confirmBooking twice for an already-confirmed booking should succeed without error (return the existing confirmed state) rather than throwing, since Chapter 9's webhook retry behavior (established in Chapter 2's webhook conventions) may call this more than once for the same event
- Write integration tests covering: successful confirmation from a valid held state, the expired-hold race condition returning the specific error result, and idempotent re-confirmation of an already-confirmed booking
```

**Expected Output:** A `confirmBooking` function with documented contract for Chapter 9 to call, a stubbed external-calendar-push interface for Chapter 8, explicit handling of the expired-hold race condition, idempotent re-confirmation behavior, and passing tests for all three scenarios.

**Success Criteria:**

- A booking successfully transitions `held → confirmed` when `confirmBooking` is called before its hold expires
- Calling `confirmBooking` on an already-expired hold does not confirm the booking and returns a distinct, specifically identifiable result that a future Chapter 9 handler can use to trigger a refund
- Calling `confirmBooking` twice on an already-confirmed booking succeeds idempotently rather than erroring
- `docs/PAYMENTS_INTEGRATION.md` documents the exact contract Chapter 9 must integrate against

**Dependencies:** Prompt 7.2

---

### Prompt 7.4 — Cancellation and No-Show Handling

**Category:** Booking Engine — Cancellation
**Objective:** Implement client-initiated cancellation (respecting the stylist's configured cancellation window) and stylist-initiated no-show marking, both of which trigger deposit refund/forfeiture logic in Chapter 9.

**Context:** Requires Prompt 7.3 and Chapter 6's Prompt 6.5 (deposit/cancellation policy service function). Like Prompt 7.3, this prompt defines the Booking Engine's side of an integration point that Chapter 9 will call into for the actual payment action.

**Prompt:**

```
Implement cancellation and no-show handling in src/modules/booking-engine/.

Requirements:
- Implement a cancelBooking(bookingId, cancelledBy, reason) service function that: validates the booking is in a cancellable state (held or confirmed), calls the business's policy service function (from Chapter 6, Prompt 6.5) to determine whether the cancellation falls within the configured cancellation_window_hours, transitions the booking to cancelled via the Prompt 7.1 state machine with the provided reason, and returns a result indicating whether a full refund, partial forfeiture, or full forfeiture applies per the policy — this result is the documented contract Chapter 9's refund logic will consume (add to docs/PAYMENTS_INTEGRATION.md)
- Implement a markNoShow(bookingId, markedBy) service function, callable only by the stylist (guard appropriately using Chapter 4's permission system, requiring can_manage_bookings), transitioning a confirmed booking to no_show and returning a result indicating the deposit should be forfeited per the policy's no_show_fee_type — again a documented contract for Chapter 9
- Both functions must reject being called on a booking already in a terminal state (completed, cancelled, no_show) with a clear error, leveraging the Prompt 7.1 state machine's transition validation rather than re-implementing state checks
- Implement POST /api/v1/bookings/:bookingId/cancel (callable by the client who owns the booking, or the stylist) and POST /api/v1/bookings/:bookingId/no-show (stylist only), wiring in the appropriate guards
- Write integration tests covering: a client cancellation within the policy window (expect full-refund result), a cancellation outside the window (expect forfeiture result per policy), a stylist marking a booking no_show (expect forfeiture result per no_show_fee_type), and rejection of any of these actions on an already-terminal booking
```

**Expected Output:** `cancelBooking` and `markNoShow` service functions with documented result contracts for Chapter 9, appropriately guarded endpoints, and passing tests for the window-respecting, forfeiting, and terminal-state-rejection scenarios.

**Success Criteria:**

- A cancellation made before the policy's cancellation window elapses returns a full-refund result; one made after returns the correct forfeiture result per the stylist's configured policy
- A stylist marking a booking as `no_show` correctly transitions state and returns the correct forfeiture result per `no_show_fee_type`
- Attempting to cancel or mark no-show on an already-`completed` or already-`cancelled` booking is rejected with a clear error
- `docs/PAYMENTS_INTEGRATION.md` documents both result contracts precisely enough for Chapter 9 to implement against without re-deriving policy logic

**Dependencies:** Prompt 7.3, Chapter 6 (Prompt 6.5)

---

### Prompt 7.5 — Manual/Dashboard-Created Bookings

**Category:** Booking Engine — Manual Entry
**Objective:** Let a stylist manually create a booking directly (e.g., for a walk-in or an off-platform arrangement they want reflected on their calendar), using the same underlying state machine and hold logic as AI- or client-created bookings.

**Context:** Requires Prompts 7.1 and 7.2. This prompt is explicitly called out in the Engineering Playbook as an edge case the Booking Engine must support — a stylist blocking calendar time for a walk-in.

**Prompt:**

```
Implement manual, dashboard-initiated booking creation in src/modules/booking-engine/.

Requirements:
- Implement POST /api/v1/bookings/manual, guarded by requireBusinessPermission('can_manage_bookings'), accepting stylist-provided start_time, an optional service_offering_id (nullable — a stylist may want to block time without it corresponding to a structured service, e.g., a personal appointment or an ad hoc walk-in with a non-standard price), an optional client identifier (nullable — the booking may not correspond to any platform client at all, just a calendar block), and creating a booking with source: dashboard_manual
- If created without a service_offering_id, require an explicit duration_minutes input instead, since end_time must always be derivable
- A manually created booking should default directly to confirmed status (skipping the held/TTL/deposit flow entirely), since the stylist is asserting this time is taken with full authority, not proposing a tentative slot pending payment — implement this as a distinct creation path in the state machine's allowed entry points (document in docs/BOOKING_STATE_MACHINE.md that confirmed is a valid initial state specifically for source: dashboard_manual bookings, as an explicit, deliberate exception to the general held-first rule)
- Manually created bookings must still be checked against the same conflict-detection logic as any other booking (no double-booking a stylist's own calendar) — reuse Prompt 7.2's conflict-checking logic rather than duplicating it
- Write integration tests covering: manual booking creation with a service offering, manual booking creation as a bare calendar block with only a duration, and rejection of a manual booking that conflicts with an existing held or confirmed booking
```

**Expected Output:** A working manual booking creation endpoint supporting both service-linked and bare calendar-block cases, correctly entering directly at `confirmed` status as a documented exception, reusing existing conflict-detection logic, with passing tests.

**Success Criteria:**

- A manually created booking is confirmed immediately, with no `hold_expires_at` ever set
- A manual booking attempt conflicting with an existing booking is rejected using the same conflict logic as Prompt 7.2, not a separately reimplemented check
- `docs/BOOKING_STATE_MACHINE.md` explicitly documents this exception to the general "everything starts as held" pattern and the specific reasoning for it

**Dependencies:** Prompts 7.1, 7.2

---

### Prompt 7.6 — Booking Conflict Detection and Resolution

**Category:** Booking Engine — Conflict Resolution
**Objective:** Consolidate and harden the conflict-detection logic used implicitly by Prompts 7.2 and 7.5, and address the specific cross-system conflict case flagged in the Engineering Playbook: a stylist manually blocking time on their external Google Calendar after a platform hold already exists for that slot.

**Context:** Requires Prompts 7.2 and 7.5. Loosely depends on Chapter 8 (external calendar sync) for the full cross-system scenario, but the platform-internal conflict logic this prompt hardens can and should be built now.

**Prompt:**

```
Consolidate and hardened booking conflict detection in src/modules/booking-engine/, and prepare the specific cross-system conflict-flagging behavior the Playbook calls out for Chapter 8's external calendar sync to call into.

Requirements:
- Extract the conflict-checking logic used by Prompt 7.2 (createHold) and Prompt 7.5 (manual bookings) into a single shared function, e.g., hasConflictingBooking(stylistId, startTime, endTime, excludeBookingId?), used by both, eliminating any duplication between the two prompts' implementations
- This function must consider held (non-expired) and confirmed bookings as conflicting, but not cancelled, completed, or no_show bookings, and not expired held bookings whose expiry hasn't yet been processed by the background job (i.e., check hold_expires_at directly in the query, not just status, to avoid a false conflict against a hold that has practically expired but not yet been cleaned up)
- Implement a flagExternalCalendarConflict(businessId, externalEventId, conflictingBookingId) service function as the documented interface Chapter 8's calendar reconciliation job will call when it detects a stylist has created an external calendar block that overlaps an existing platform hold or confirmed booking — per the Playbook, this should not silently override either side; it should create a flagged record for the stylist to resolve manually
- Add a calendar_conflicts table: id, business_id (FK), booking_id (FK, nullable), external_event_id (text), detected_at, resolved_at (nullable), resolution (enum: kept_platform_booking, kept_external_event, manual_other, nullable until resolved)
- Implement GET /api/v1/businesses/me/calendar-conflicts and POST /api/v1/businesses/me/calendar-conflicts/:conflictId/resolve for the stylist to view and resolve flagged conflicts (the dashboard UI for this is Chapter 17's concern — this prompt only needs the API)
- Write integration tests covering: the shared conflict-check function correctly ignoring cancelled/completed bookings and correctly treating an about-to-expire-but-not-yet-cleaned-up hold as still conflicting, and the external-conflict-flagging function creating a correctly structured calendar_conflicts record without modifying either the booking or (conceptually) the external event
```

**Expected Output:** A single, shared, hardened conflict-detection function used consistently by Prompts 7.2 and 7.5, a `calendar_conflicts` table and flagging function ready for Chapter 8 to call, resolution endpoints, and passing tests for the listed edge cases.

**Success Criteria:**

- Prompts 7.2 and 7.5's conflict checks are confirmed, via code review, to both call the same shared function rather than each maintaining separate logic
- A held booking with a past `hold_expires_at` that has not yet been cleaned up by the background job is still correctly treated as non-conflicting for new hold attempts (since it is practically expired) — verified by a specific test
- The external-conflict-flagging function is confirmed, via test, to create a `calendar_conflicts` record without altering the underlying booking's status

**Dependencies:** Prompts 7.2, 7.5

---

## Chapter 7 Summary

At the end of this chapter, the platform has a fully functional, concurrency-safe booking transactional core: a validated state machine, TTL-based holds, a confirmation flow with a documented contract for Chapter 9's payment integration, cancellation/no-show handling with documented refund-decision contracts, manual booking support, and consolidated conflict detection ready for Chapter 8's external calendar sync to build on.

**Three explicit cross-chapter contracts were established in this chapter and must be honored exactly when their dependent chapters are built:** Prompt 7.3's `confirmBooking` contract (for Chapter 9), Prompt 7.4's `cancelBooking`/`markNoShow` result contracts (for Chapter 9), and Prompt 7.6's `flagExternalCalendarConflict` interface (for Chapter 8). Revisit `docs/PAYMENTS_INTEGRATION.md` and `docs/BOOKING_STATE_MACHINE.md` when building those chapters rather than re-deriving these contracts from scratch.

---

Ready to proceed to Chapter 8 (Calendar & Availability) when you are.
