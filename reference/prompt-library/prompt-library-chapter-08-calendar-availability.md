# Chapter 8 — Calendar & Availability

## Overview

This chapter builds the availability computation engine that turns a stylist's working-hours rules (Chapter 6) and existing bookings (Chapter 7) into a concrete list of bookable time slots, and implements two-way Google Calendar sync so the platform never double-books against a stylist's personal or off-platform schedule. It also implements duration/buffer-aware slot generation and the reconciliation background job that keeps platform and external calendar state consistent over time.

## Why This Chapter Exists

The Booking Engine (Chapter 7) knows how to hold and confirm a specific time slot once one is chosen, but something must first compute which slots are actually offerable — combining working hours, existing bookings, buffer time, and an external calendar the stylist may also be using. This chapter exists to own that computation cleanly, as its own concern, rather than scattering slot-generation logic across the AI Receptionist (Chapter 13) or dashboard (Chapter 17), both of which will simply call into this chapter's service layer.

## Prompts in This Chapter

8.1 Availability computation engine
8.2 Google Calendar two-way sync
8.3 Buffer time and duration-aware slot generation
8.4 Calendar reconciliation background job

---

### Prompt 8.1 — Availability Computation Engine

**Category:** Calendar & Availability — Foundation
**Objective:** Implement the core function that computes a stylist's actually-available time slots for a given date range and service duration, combining Chapter 6's working-hours rules with Chapter 7's existing bookings.

**Context:** Requires Chapter 6 (Prompt 6.6's `getBaseAvailabilityRules` function) and Chapter 7 (the `bookings` table and its conflict-detection logic from Prompt 7.6). This is the foundational prompt of the chapter; Prompts 8.2-8.4 extend it.

**Prompt:**

```
Implement the availability computation engine in a new src/modules/calendar/ module (update ARCHITECTURE.md: owns availability computation and external calendar sync; does not own working-hours rule storage, which remains Stylist Profile's domain per Chapter 6, and does not own booking state itself, which remains the Booking Engine's domain per Chapter 7 — this module reads from both and produces a derived view).

Requirements:
- Implement a getAvailableSlots(businessId, dateRange, durationMinutes) service function that: calls Chapter 6's getBaseAvailabilityRules to get the stylist's working hours and exceptions for the range, generates candidate slot start times at a configurable granularity (e.g., every 15 or 30 minutes within working hours), and filters out any candidate whose resulting time range would conflict with an existing booking, using Chapter 7's hasConflictingBooking function from Prompt 7.6 (do not reimplement conflict logic here — call into it)
- The function must correctly handle a requested durationMinutes that doesn't evenly divide the slot granularity (e.g., a 5-hour, 15-minute braiding appointment against 30-minute granularity) by checking the full requested duration against conflicts, not just the candidate start slot
- Implement GET /api/v1/businesses/:businessId/availability as the externally-callable endpoint (public — clients and the AI Receptionist both need this without requiring stylist-level authentication), accepting a date range and a service_offering_id (from which duration is derived via Chapter 6's data) or an explicit duration_minutes
- Cap the maximum queryable date range (e.g., 60 days) to prevent unbounded computation from a single request
- Write integration tests covering: a stylist with straightforward daily hours and no bookings returning the expected slot set, a stylist with an existing confirmed booking correctly excluding overlapping candidate slots, and a long-duration service correctly excluding candidates that would run into a later booking even though the candidate's own start time doesn't directly overlap it
```

**Expected Output:** A `getAvailableSlots` function correctly combining working-hours and booking-conflict data without duplicating either's underlying logic, a public availability endpoint, date-range capping, and passing tests including the long-duration-conflict edge case.

**Success Criteria:**

- A test stylist with 9am-5pm hours and no bookings returns the full expected set of candidate slots for a given day
- A 5-hour service candidate slot starting at 1pm is correctly excluded from results if a separate booking already exists at 4pm, even though 1pm itself doesn't overlap 4pm — because the full 5-hour span does
- The endpoint rejects a date range exceeding the configured maximum with a clear validation error

**Dependencies:** Chapter 6 (Prompt 6.6), Chapter 7 (Prompt 7.6)

---

### Prompt 8.2 — Google Calendar Two-Way Sync

**Category:** Calendar & Availability — External Integration
**Objective:** Let a stylist connect their Google Calendar so platform-confirmed bookings appear there automatically, and so events they create directly in Google Calendar are reflected back as unavailability on the platform.

**Context:** Requires Prompt 8.1 and Chapter 3's OAuth infrastructure (reuse the same encrypted-token-storage pattern established for Google OAuth login in Prompt 3.3, extended here for Calendar API scope rather than just identity). Also depends on Chapter 7's Prompt 7.3, which stubbed a `pushToExternalCalendar` interface this prompt now implements for real.

**Prompt:**

```
Implement two-way Google Calendar sync in src/modules/calendar/.

Requirements:
- Extend the OAuth connection flow (reusing Chapter 3's OAuth client and encrypted token storage pattern, requesting the additional Google Calendar API scope) to let a stylist connect their calendar independently of using Google for login — a stylist who logged in with email/password should still be able to connect Calendar separately
- Implement the real pushToExternalCalendar(bookingId) function that Chapter 7's Prompt 7.3 stubbed: on booking confirmation, create a corresponding event in the stylist's connected Google Calendar via the Calendar API, and store the mapping in an external_calendar_links table: id, business_id (FK), provider (enum: google), external_event_id, booking_id (FK, nullable — null for externally-created blocks with no corresponding platform booking), sync_status (enum: synced, pending, failed)
- Implement inbound sync via Google Calendar push notifications (webhooks): when the stylist's calendar changes externally (a new event created directly in Google Calendar, not originating from the platform), receive the change notification, and for any new external event that has no corresponding external_calendar_links row (i.e., not one the platform itself created), treat it as a potential conflict and call Chapter 7's Prompt 7.6 flagExternalCalendarConflict function rather than silently blocking or ignoring it
- Handle booking cancellation: when a platform booking is cancelled (Chapter 7's cancelBooking), delete or mark cancelled the corresponding Google Calendar event via its stored external_event_id
- Follow Chapter 2's webhook-handling conventions (signature/token verification, idempotent processing via the shared processed_webhook_events table) for Google's push notification channel
- Write integration tests using a mocked Google Calendar API client covering: successful event creation on booking confirmation, successful event deletion on cancellation, and an inbound external event with no matching platform booking correctly triggering the conflict-flagging function rather than being silently dropped or silently blocking the slot
```

**Expected Output:** Extended OAuth connection for Calendar scope, a real `pushToExternalCalendar` implementation, an `external_calendar_links` table, inbound webhook handling that flags genuine conflicts rather than silently resolving them, cancellation-triggered event deletion, and passing tests against a mocked Calendar API client.

**Success Criteria:**

- Confirming a platform booking is confirmed, via test against the mocked client, to create a corresponding Google Calendar event and store the correct `external_calendar_links` mapping
- Cancelling a platform booking correctly triggers deletion/cancellation of its corresponding external event
- An external event created directly in Google Calendar (simulated in the mocked inbound webhook test) with no existing platform link correctly results in a `calendar_conflicts` record via Chapter 7's flagging function, not a silent block or silent ignore

**Dependencies:** Prompt 8.1, Chapter 3 (OAuth), Chapter 7 (Prompts 7.3, 7.6)

---

### Prompt 8.3 — Buffer Time and Duration-Aware Slot Generation

**Category:** Calendar & Availability — Refinement
**Objective:** Extend Prompt 8.1's slot generation to respect stylist-configurable buffer time between appointments, and refine candidate-slot generation to be genuinely duration-aware rather than relying solely on the conflict-exclusion approach from 8.1.

**Context:** Requires Prompt 8.1. This prompt is a refinement pass on the core availability engine, adding a configuration option the Playbook specifically calls out (configurable buffer time between appointments).

**Prompt:**

```
Extend the availability computation engine (Prompt 8.1) to support configurable buffer time between appointments.

Requirements:
- Add a buffer_minutes column to the businesses table (or the business_policies table from Chapter 6's Prompt 6.5, whichever is the more appropriate existing home per that module's schema — coordinate to avoid creating a redundant policy table), defaulting to a sensible value (e.g., 15 minutes), configurable by the stylist via an endpoint analogous to the policy-management pattern from Chapter 6
- Update getAvailableSlots (Prompt 8.1) so that a candidate slot's effective "occupied" range for conflict-checking purposes includes the buffer both before and after the appointment's actual start/end time — i.e., a booking from 2:00-4:00pm with a 15-minute buffer should block candidate slots that would start as early as 1:45pm or end as late as 4:15pm for the next appointment, not just exactly 2:00-4:00pm
- Ensure buffer time is applied consistently whether the existing booking came from a platform hold, a confirmed booking, or a manually created dashboard booking (Chapter 7, Prompt 7.5) — buffer logic should live entirely in this module's slot-generation function, not be duplicated into the Booking Engine's conflict-checking function from Prompt 7.6 (which should remain a strict, buffer-agnostic overlap check; this module layers buffer on top when generating client-facing availability)
- Write integration tests confirming: a stylist with a 15-minute buffer and an existing 2:00-4:00pm booking does not offer a 4:00pm or 4:10pm slot start for a service that would begin immediately after, but does correctly offer a 4:15pm slot
```

**Expected Output:** A `buffer_minutes` configuration option, updated slot-generation logic correctly applying buffer time on both sides of existing bookings, and passing tests confirming buffer-respecting slot exclusion and inclusion.

**Success Criteria:**

- Given a 15-minute buffer and an existing 2:00-4:00pm booking, a candidate slot starting at 4:00pm or 4:10pm is correctly excluded, while one starting at 4:15pm is correctly included
- Buffer logic is confirmed, via code review, to live in this module's availability computation rather than having leaked into Chapter 7's stricter conflict-checking function

**Dependencies:** Prompt 8.1, Chapter 6 (Prompt 6.5, for the policy table home)

---

### Prompt 8.4 — Calendar Reconciliation Background Job

**Category:** Calendar & Availability — Reliability
**Objective:** Implement the periodic polling job that catches any external calendar changes missed by Prompt 8.2's push-notification webhook (Google's push notifications can be delayed, dropped, or subject to subscription expiry), ensuring the platform's view of external calendar state never silently drifts out of sync for long.

**Context:** Requires Prompt 8.2 (webhook-based sync must already exist; this prompt is the fallback/reconciliation layer on top of it) and Chapter 2's background job infrastructure.

**Prompt:**

```
Implement a periodic calendar reconciliation background job in src/modules/calendar/, using Chapter 2's job infrastructure, as the fallback safety net for Prompt 8.2's webhook-based sync.

Requirements:
- Implement a recurring job (e.g., running every 30 minutes per connected stylist calendar) that fetches the stylist's Google Calendar events for a rolling window (e.g., today through 60 days ahead, matching the availability engine's maximum queryable range from Prompt 8.1) and compares them against the platform's external_calendar_links records for that period
- For any external event found that has no corresponding external_calendar_links row, apply the same flagExternalCalendarConflict logic from Prompt 8.2's webhook handler (reuse the function, do not duplicate the conflict-flagging logic)
- For any external_calendar_links row whose corresponding platform booking was cancelled but whose external event deletion (from Prompt 8.2) may have failed or not yet propagated, detect the mismatch and retry the deletion, logging a warning if it fails repeatedly
- Handle and recover from Google Calendar push-notification subscription expiry (these subscriptions have a limited lifetime per Google's API) by proactively renewing the subscription before expiry, tracked via a subscription_expires_at field on the stylist's calendar connection record
- Ensure this job is idempotent and safe to run concurrently for different stylists without interfering with each other (process each stylist's reconciliation independently, and use appropriate locking if a single stylist's reconciliation could otherwise be triggered twice concurrently)
- Write integration tests, using a mocked Google Calendar API client, covering: detection and flagging of an untracked external event during reconciliation (not just via the webhook path), successful retry of a previously failed external event deletion, and proactive subscription renewal before the tracked expiry time
```

**Expected Output:** A recurring reconciliation job covering conflict detection, deletion-retry, and subscription renewal, all reusing existing logic from Prompt 8.2 rather than duplicating it, with passing tests for each of the three scenarios.

**Success Criteria:**

- The reconciliation job correctly flags an external event that was never caught by the webhook path (simulating a missed/dropped webhook), verified by test
- A previously failed external event deletion is retried and confirmed to succeed on the next reconciliation run
- Subscription renewal is confirmed to trigger before the stored `subscription_expires_at` time, not after
- The job is confirmed, via test or code review, to process each stylist independently without cross-stylist interference

**Dependencies:** Prompt 8.2, Chapter 2 (background jobs)

---

## Chapter 8 Summary

At the end of this chapter, the platform has a complete availability system: a core slot-computation engine combining working hours and bookings, two-way Google Calendar sync with proper conflict-flagging (never silent override), buffer-aware slot generation, and a reconciliation job that keeps the platform resilient to missed webhooks and expiring push-notification subscriptions. Chapter 7's `pushToExternalCalendar` and `flagExternalCalendarConflict` stubs are now fully implemented and should be considered the authoritative, complete versions going forward.

**A note on the conflict-flagging philosophy carried through this entire chapter:** at no point does the system silently choose the platform booking or the external event as authoritative when they conflict — every such case is surfaced to the stylist for manual resolution (via the endpoints built in Chapter 7's Prompt 7.6). This is a deliberate design choice worth preserving in any future refactor of this chapter, since silent auto-resolution in either direction risks either losing a paid client booking or double-booking the stylist's actual time.

---

Ready to proceed to Chapter 9 (Payments & Deposits) when you are.
