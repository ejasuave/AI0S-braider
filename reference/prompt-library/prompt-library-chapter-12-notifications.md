# Chapter 12 — Notifications

## Overview

This chapter implements the notification delivery system: the notification schema and delivery worker, appointment reminder scheduling, confirmation/cancellation notifications, and compliance handling (opt-out/STOP keyword enforcement). Per `ARCHITECTURE.md`, Notifications owns delivery timing and channel selection; it does not own message content generation, which delegates to the same content layer the AI Receptionist (Chapter 13) uses, so tone stays consistent whether a message comes from a live conversation or an automated reminder.

## Why This Chapter Exists

Reminders and confirmations are the platform's most direct lever on the no-show problem the entire business case is built around — but a notification system that duplicates the client's active conversation with the AI Receptionist, or that fires after a cancellation has already happened, actively damages trust rather than building it. This chapter exists to build notification delivery as a careful, status-aware system that always checks current booking state immediately before sending, rather than a naive fire-and-forget scheduler.

## Prompts in This Chapter

12.1 Notification schema and delivery worker
12.2 Appointment reminder scheduling
12.3 Confirmation/cancellation notifications
12.4 Opt-out/compliance handling (STOP keyword, etc.)

---

### Prompt 12.1 — Notification Schema and Delivery Worker

**Category:** Notifications — Foundation
**Objective:** Create the `notifications` table and the background delivery worker that every specific notification type (reminders, confirmations, cancellations) in this chapter will enqueue into and be processed by.

**Context:** Requires Chapter 2 (background job infrastructure), Chapter 11 (channel-agnostic `sendMessage` from Prompt 11.1, which this module reuses for actual delivery rather than talking to Twilio/WhatsApp directly), and Chapter 5 (Prompt 5.4's notification preferences, which this worker must respect).

**Prompt:**

```
Implement the notification schema and delivery worker in a new src/modules/notifications/ module (update ARCHITECTURE.md: owns delivery timing, scheduling, and channel selection; does not own message content generation logic, which delegates to a shared content layer also used by the AI Receptionist — Chapter 13 — so tone and information stay consistent across automated and conversational messages).

Requirements:
- Add a notifications table: id, booking_id (FK, nullable — some future notification types may not be booking-specific), recipient_id (FK to users), type (enum: reminder_48h, reminder_2h, confirmation, cancellation, no_show_notice), status (enum: scheduled, sent, failed, skipped), scheduled_for (timestamptz), sent_at (timestamptz, nullable), skip_reason (text, nullable — populated when a scheduled notification is correctly skipped rather than sent, e.g., due to a preference opt-out or a booking status change)
- Implement a channel-agnostic content-generation interface, e.g., a generateNotificationContent(type, context) function, that this prompt should stub with straightforward, clear templated text for each notification type for now — note in a code comment that Chapter 13 may eventually enrich this with the same AI-driven content layer used in live conversation, but a reliable templated baseline must exist and work correctly on its own, independent of any AI call succeeding or failing
- Implement the delivery worker as a recurring background job (using Chapter 2's infrastructure) that: finds notifications rows with status: scheduled and scheduled_for in the past, checks the recipient's current notification preferences (Chapter 5, Prompt 5.4) and the notification's relevance still holding (e.g., for a reminder, the underlying booking must still be confirmed — checked immediately before send, not just at scheduling time), sends via Chapter 11's channel-agnostic sendMessage if all checks pass, and marks the row sent or skipped (with a skip_reason) accordingly — never silently drops a notification without a recorded reason
- Write unit tests for the content-generation stub covering all five notification types producing non-empty, sensible text, and integration tests for the delivery worker covering: successful send, a skip due to opted-out preferences, and a skip due to the underlying booking no longer being in the expected status
```

**Expected Output:** A `notifications` table, a stubbed-but-functional content-generation interface, a recurring delivery worker with status/preference/relevance checks immediately before send, and passing tests for the send and both skip scenarios.

**Success Criteria:**

- A scheduled notification for a booking that was cancelled before the send time is confirmed, via test, to be marked `skipped` with a clear `skip_reason`, not sent
- A scheduled notification for a recipient who has opted out via Chapter 5's preferences is similarly skipped with a clear reason
- Every notification type produces distinct, sensible template content via the stub function, confirmed by test

**Dependencies:** Chapter 2, Chapter 5 (Prompt 5.4), Chapter 11 (Prompt 11.1)

---

### Prompt 12.2 — Appointment Reminder Scheduling

**Category:** Notifications — Reminders
**Objective:** Implement the actual scheduling logic that creates `reminder_48h` and `reminder_2h` notification rows when a booking is confirmed, feeding Prompt 12.1's delivery worker.

**Context:** Requires Prompt 12.1 and Chapter 7 (booking confirmation as the triggering event). This prompt defines when reminders get scheduled; Prompt 12.1 defines how they get delivered.

**Prompt:**

```
Implement appointment reminder scheduling in src/modules/notifications/.

Requirements:
- Subscribe to the booking-confirmation event (using the same event/callback integration pattern established in Chapter 9's Payments-subscribes-to-Booking-Engine precedent, rather than the Booking Engine directly importing and calling this module) to trigger scheduling of both a reminder_48h and a reminder_2h notifications row (per Prompt 12.1's schema) at the appropriate scheduled_for times relative to the booking's start_time
- Handle the case where a booking is confirmed with less than 48 hours (or less than 2 hours) of lead time — do not schedule a reminder whose scheduled_for time would already be in the past; skip creating that specific reminder row entirely rather than creating one the delivery worker would immediately need to handle as a backdated edge case
- Handle booking rescheduling (if the Booking Engine supports changing a confirmed booking's time, e.g., via Chapter 7's Prompt 7.4-adjacent extension logic) by cancelling any not-yet-sent reminder rows for that booking and rescheduling fresh ones against the new start_time — subscribe to a booking-time-changed event equivalently, or, if no such distinct event exists yet in Chapter 7, document this as a specific integration point Chapter 7 should be revisited to emit
- Handle booking cancellation by cancelling (not sending) any not-yet-sent reminder rows for that booking — subscribe to the cancellation event similarly
- Write integration tests covering: standard 48h/2h reminder scheduling on confirmation, correct skip of a reminder type when lead time is insufficient, and correct cancellation of pending reminders when a booking is subsequently cancelled before either reminder fires
```

**Expected Output:** Event-driven reminder scheduling on booking confirmation, correct handling of short-lead-time bookings, cancellation of pending reminders on booking cancellation (and rescheduling logic or a flagged integration gap for booking-time changes), and passing tests for all listed scenarios.

**Success Criteria:**

- A booking confirmed with more than 48 hours of lead time correctly gets both reminder rows scheduled at the right times, verified by test
- A booking confirmed only 90 minutes before its start time correctly skips scheduling both the 48h and 2h reminders (both would be in the past) without erroring
- A booking cancelled before its reminders fire results in those reminder rows being cancelled, verified by a test confirming the delivery worker (Prompt 12.1) would correctly skip them if it ran

**Dependencies:** Prompt 12.1, Chapter 7 (confirmation/cancellation events)

---

### Prompt 12.3 — Confirmation/Cancellation Notifications

**Category:** Notifications — Transactional Messaging
**Objective:** Implement the immediate (not scheduled-for-later) notifications sent at the moment a booking is confirmed or cancelled, distinct from the delayed reminders in Prompt 12.2.

**Context:** Requires Prompt 12.1 and Chapter 7's confirmation/cancellation events (the same subscription pattern as Prompt 12.2).

**Prompt:**

```
Implement immediate confirmation and cancellation notifications in src/modules/notifications/.

Requirements:
- Subscribe to the same booking-confirmation event used in Prompt 12.2 to immediately create and enqueue-for-near-instant-delivery a confirmation-type notifications row (scheduled_for set to now, so Prompt 12.1's worker picks it up on its very next run rather than waiting for a scheduled future time) — send to both the client and, separately, a distinct stylist-facing confirmation summary (reuse Chapter 1's established pattern of clear, minimal stylist-facing summaries, e.g., "New booking confirmed for Friday 2pm, £30 deposit paid" per the pitch's own example language)
- Subscribe to the cancellation event similarly, sending a cancellation notification to the client (confirming their refund status per Chapter 7/9's cancellation result) and a distinct notice to the stylist
- Subscribe to the no-show-marked event, sending a notice to the stylist confirming the deposit forfeiture outcome (no client-facing no-show notification is needed, since the client is aware they didn't attend)
- These transactional notification types (confirmation, cancellation, no_show_notice) must never be skippable via the marketing_messages_enabled preference from Chapter 5 — confirm in code and via test that only appointment_reminders_enabled (used for the Prompt 12.2 reminder types) is ever checked as a skip condition for these transactional types, consistent with the schema decision already made in Chapter 5, Prompt 5.4, that there is no field to disable transactional messages
- Write integration tests covering: correct dual (client + stylist) notification creation on confirmation, correct notification content reflecting actual refund status on cancellation, and confirmation that these notification types are sent even for a client who has disabled marketing_messages_enabled (proving transactional messages are never gated by that preference)
```

**Expected Output:** Event-driven immediate confirmation, cancellation, and no-show notifications for both clients and stylists, with explicit, tested confirmation that transactional types bypass the marketing-preference gate entirely, per Chapter 5's schema design.

**Success Criteria:**

- A booking confirmation correctly and immediately produces both a client-facing and a distinct stylist-facing notification, verified by test
- A cancellation notification's content is confirmed, via test, to accurately reflect whether a refund was issued or the deposit was forfeited, based on Chapter 7/9's actual result
- A client with `marketing_messages_enabled: false` still receives confirmation/cancellation notifications, proving the transactional bypass works as designed

**Dependencies:** Prompt 12.1, Chapter 7 (confirmation/cancellation/no-show events), Chapter 9 (refund status for cancellation content)

---

### Prompt 12.4 — Opt-Out/Compliance Handling

**Category:** Notifications — Compliance
**Objective:** Perform a dedicated compliance audit and hardening pass ensuring STOP-keyword and equivalent opt-out mechanisms are correctly and consistently enforced across every notification type and channel built in this chapter, closing the loop on Chapter 5's `handleStopKeyword` and Chapter 11's channel-level opt-out handling.

**Context:** Requires Prompts 12.1-12.3, Chapter 5 (Prompt 5.4), and Chapter 11 (Prompts 11.2-11.3's STOP-keyword delegation). This is a chapter-closing hardening prompt, similar in spirit to Chapter 3's Prompt 3.6 and Chapter 9's Prompt 9.4.

**Prompt:**

```
Perform a dedicated compliance audit and hardening pass on opt-out handling across the notification system, verifying correct end-to-end behavior from an inbound STOP keyword (Chapter 11) through preference storage (Chapter 5) to actual delivery-worker enforcement (Prompt 12.1).

Requirements:
- Trace and verify, with an explicit end-to-end integration test, the full path: an inbound SMS or WhatsApp message containing STOP (Chapter 11, Prompts 11.2/11.3) correctly calls Chapter 5's handleStopKeyword, which correctly updates notification_preferences, which the delivery worker (Prompt 12.1) correctly reads and respects on its very next run for that recipient — this test should exercise the real chain across all three modules, not a mocked version of each
- Verify and, if necessary, correct that re-subscription (a client who previously texted STOP later wants reminders again, e.g., by texting START or an equivalent keyword, or by explicitly re-enabling preferences through the client profile UI from Chapter 5) is supported and correctly re-enables future reminder delivery
- Add a platform-wide opt-out audit log (a simple append-only table or reuse of the structured logging convention from Chapter 1) recording every opt-out and re-opt-in event with timestamp and originating channel, since demonstrating compliance history may be necessary for regulatory or dispute purposes
- Verify no notification type in Prompt 12.3 (confirmation, cancellation, no_show_notice) can ever be gated by the opt-out mechanism, consistent with the transactional-message design decision from Chapter 5 — add an explicit regression test guarding against a future accidental change that might add reminders_enabled-style gating to a transactional type
- Document the complete opt-out/compliance behavior in a new docs/COMPLIANCE.md, including the full STOP-to-skip chain, the re-opt-in mechanism, and the explicit list of never-gateable transactional notification types
```

**Expected Output:** A verified (and where needed, corrected) end-to-end STOP-to-skip chain across three modules, working re-opt-in support, an opt-out audit log, an explicit regression test protecting transactional-type ungate-ability, and complete compliance documentation.

**Success Criteria:**

- The end-to-end integration test is confirmed to exercise the real Chapter 11 → Chapter 5 → Chapter 12 chain (not mocks at each boundary) and to result in the delivery worker correctly skipping a subsequent reminder for the opted-out recipient
- A re-opt-in action is confirmed, via test, to restore reminder delivery on the next eligible notification
- The regression test guarding transactional-type ungate-ability is confirmed to fail if a hypothetical future change attempted to add preference-gating to `confirmation`, `cancellation`, or `no_show_notice` types, proving it would actually catch such a regression
- `docs/COMPLIANCE.md` accurately and completely describes the behavior verified by this prompt's tests

**Dependencies:** Prompts 12.1, 12.2, 12.3, Chapter 5 (Prompt 5.4), Chapter 11 (Prompts 11.2, 11.3)

---

## Chapter 12 Summary

At the end of this chapter, the platform has complete notification coverage: a robust, preference-and-status-aware delivery worker, correctly scheduled reminders that gracefully handle short lead times and cancellations, immediate transactional confirmation/cancellation/no-show notifications that can never be silently opted out of, and a fully verified, end-to-end, audited opt-out compliance chain spanning three modules.

**Prompt 12.4's end-to-end compliance test is the single most valuable test in this chapter** — it is the only one that actually proves the full cross-module chain works together rather than verifying each module's piece in isolation. If time is constrained during implementation, do not skip this integration test in favor of only the per-module unit tests in Prompts 12.1-12.3.

---

Ready to proceed to Chapter 13 (AI Receptionist) when you are.
