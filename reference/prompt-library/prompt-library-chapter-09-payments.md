# Chapter 9 — Payments & Deposits

## Overview

This chapter implements the platform's money-movement layer: Stripe Connect onboarding for stylist payouts, deposit PaymentIntent creation and capture, refund and forfeiture logic consuming the result contracts Chapter 7 established, idempotent webhook handling built on Chapter 2's shared conventions, payout scheduling, and chargeback/dispute evidence handling. Per `ARCHITECTURE.md`, Payments owns deposit capture, refunds, and payout scheduling — it does not own pricing decisions, which remain Stylist Profile's domain.

## Why This Chapter Exists

This is one of the two highest-risk chapters in the entire library (alongside Authentication) — money is moving, and mistakes here are expensive, hard to reverse, and directly damage trust with stylists whose livelihood depends on correct payouts. This chapter exists to implement payments once, on top of the already-hardened webhook-idempotency pattern from Chapter 2 and the already-defined booking-state contracts from Chapter 7, rather than treating payment logic as an afterthought bolted onto the booking flow.

## Prompts in This Chapter

9.1 Stripe Connect onboarding for stylists
9.2 Deposit PaymentIntent creation and capture
9.3 Refund and forfeiture logic
9.4 Webhook handling with idempotency
9.5 Payout scheduling and reporting
9.6 Chargeback/dispute evidence handling

---

### Prompt 9.1 — Stripe Connect Onboarding for Stylists

**Category:** Payments — Foundation
**Objective:** Let a stylist complete Stripe Connect onboarding so the platform never directly holds KYC/compliance responsibility for their payout identity, following the Playbook's explicit architectural choice.

**Context:** Requires Chapter 6 (Prompt 6.1, the `businesses` table) and Chapter 3 (a `stylist_owner` user must exist). This is the foundational prompt of the chapter — no deposit or payout logic can function without a connected Stripe account.

**Prompt:**

```
Implement Stripe Connect onboarding in a new src/modules/payments/ module (update ARCHITECTURE.md: owns deposit capture, refunds, payout scheduling; does not own pricing decisions, which remain Stylist Profile's domain per Chapter 6).

Requirements:
- Add columns to the businesses table (or a dedicated payment_accounts table, preferred for clarity — id, business_id FK unique, stripe_connect_account_id, onboarding_status enum: not_started/in_progress/complete/restricted, charges_enabled boolean, payouts_enabled boolean)
- Implement POST /api/v1/businesses/me/stripe/onboarding-link, guarded by requireBusinessPermission('can_view_payouts') (a new permission flag, extending Chapter 4's taxonomy — reasonable default: implicitly true for the owner, explicitly grantable to staff), creating a Stripe Connect Express account if one doesn't exist yet, and returning a Stripe-hosted onboarding link for the stylist to complete KYC directly with Stripe
- Implement the Stripe Connect account webhook handler (account.updated events) following Chapter 2's webhook conventions exactly (signature verification, idempotent processing via processed_webhook_events), updating onboarding_status, charges_enabled, and payouts_enabled based on the account's current state
- Implement GET /api/v1/businesses/me/stripe/status returning the current onboarding/capability status, for the stylist dashboard (Chapter 17) to display
- Ensure no other part of the platform (e.g., the Booking Engine, Chapter 7) allows a deposit-requiring booking hold to proceed for a business whose charges_enabled is false — implement this as an explicit precondition check callable by Chapter 7, e.g., an isPaymentReady(businessId) service function
- Write integration tests, using Stripe's test mode, covering: onboarding link generation, the account.updated webhook correctly updating status flags, and the isPaymentReady function correctly gating on charges_enabled
```

**Expected Output:** A payment-account schema, a working onboarding-link endpoint, a webhook handler following Chapter 2's idempotency conventions, a status endpoint, and an `isPaymentReady` gating function ready for Chapter 7 to consume, with passing tests.

**Success Criteria:**

- A stylist without a Stripe account can generate a valid onboarding link and, after completing Stripe's test-mode onboarding flow, has their `onboarding_status` correctly updated via the webhook
- `isPaymentReady` returns false for a business with `charges_enabled: false`, verified by test
- The webhook handler is confirmed to reuse Chapter 2's shared `processed_webhook_events` idempotency table rather than implementing separate deduplication logic

**Dependencies:** Chapter 3, Chapter 6 (Prompt 6.1)

---

### Prompt 9.2 — Deposit PaymentIntent Creation and Capture

**Category:** Payments — Core Transaction
**Objective:** Implement deposit charge creation tied to a held booking, and the capture logic that confirms the booking upon successful payment, fulfilling the contract Chapter 7's Prompt 7.3 (`confirmBooking`) established.

**Context:** Requires Prompt 9.1 and Chapter 7 (Prompts 7.2 and 7.3 — holds and the `confirmBooking` contract). This is the central payment-flow prompt of the chapter.

**Prompt:**

```
Implement deposit PaymentIntent creation and capture in src/modules/payments/, integrating with Chapter 7's confirmBooking contract documented in docs/PAYMENTS_INTEGRATION.md.

Requirements:
- Add a payments table: id, booking_id (FK, unique per active payment), stripe_payment_intent_id (text, unique), amount (numeric), status (enum: pending, captured, refunded, forfeited, failed), created_at
- Implement a createDepositCharge(bookingId) service function that: looks up the held booking (via Chapter 7's booking service, not direct table access), calls Chapter 6's Prompt 6.5 policy service to compute the required deposit_amount, verifies isPaymentReady (Prompt 9.1) for the business, creates a Stripe PaymentIntent for that amount on the connected account, stores a payments row with status: pending, and returns a client-facing payment link/client secret
- Implement POST /api/v1/bookings/:bookingId/deposit as the externally-callable endpoint wrapping createDepositCharge, to be called by the AI Receptionist (Chapter 13) after a slot is selected
- Implement the Stripe webhook handler for payment_intent.succeeded, following Chapter 2's conventions exactly: verify signature, check processed_webhook_events for the event ID, and on first processing, mark the payments row status: captured and call Chapter 7's confirmBooking(bookingId) — handling the documented expired-hold race-condition result from Prompt 7.3 by triggering an automatic refund (implemented fully in Prompt 9.3, but call its interface now) if confirmBooking reports the hold had already expired
- Implement the Stripe webhook handler for payment_intent.payment_failed, marking the payments row status: failed and leaving the booking in its held state (the existing TTL expiry job from Chapter 7 will naturally clean it up if the client doesn't retry in time)
- Write integration tests, using Stripe's test mode/test webhook payloads, covering: successful deposit creation and capture correctly confirming the booking, a failed payment leaving the booking held (not confirmed, not cancelled), and the expired-hold race condition correctly triggering a refund rather than confirming a booking whose slot may no longer be honorable
```

**Expected Output:** A `payments` table, a `createDepositCharge` function correctly delegating to Chapter 6's policy and Chapter 7's booking service rather than duplicating their logic, webhook handlers for success and failure following Chapter 2's exact conventions, correct handling of the expired-hold race condition, and passing tests for all listed scenarios.

**Success Criteria:**

- A successful test-mode payment correctly transitions the booking from `held` to `confirmed` via Chapter 7's `confirmBooking`, verified end to end
- A failed payment leaves the booking in `held` status, unaffected, allowing a retry
- Simulating an expired hold at the moment the success webhook arrives is confirmed, via test, to trigger a refund rather than confirming the booking — proving the race condition documented in Chapter 7's Prompt 7.3 is correctly handled here, not silently mishandled

**Dependencies:** Prompt 9.1, Chapter 6 (Prompt 6.5), Chapter 7 (Prompts 7.2, 7.3)

---

### Prompt 9.3 — Refund and Forfeiture Logic

**Category:** Payments — Cancellation Handling
**Objective:** Implement the actual Stripe refund/forfeiture actions consuming the result contracts Chapter 7's Prompt 7.4 (`cancelBooking`, `markNoShow`) established, plus the automatic-refund path referenced by Prompt 9.2's race-condition handling.

**Context:** Requires Prompt 9.2 and Chapter 7 (Prompt 7.4's documented result contracts).

**Prompt:**

```
Implement refund and forfeiture logic in src/modules/payments/, consuming the result contracts from Chapter 7's Prompt 7.4 (cancelBooking, markNoShow) documented in docs/PAYMENTS_INTEGRATION.md.

Requirements:
- Implement a processRefund(bookingId, refundType) function where refundType is one of full, partial, none, matching the categories Chapter 7's cancelBooking/markNoShow results can produce — for full, issue a full Stripe refund of the captured deposit; for partial (used for manual stylist-initiated goodwill gestures, not automatic policy application, since the Playbook's policy model is currently full-refund-or-forfeit, not percentage-partial by default), issue the specified partial amount; for none, mark the payments row status: forfeited and leave the captured funds in place, to be included in the stylist's next payout (Prompt 9.5)
- Wire this function to be called automatically whenever Chapter 7's cancelBooking or markNoShow functions are invoked and produce a refund-relevant result — implement this as an event/callback the Booking Engine module triggers (e.g., the Booking Engine module emits a domain event, and this module subscribes, rather than the Booking Engine module directly importing and calling Payments code, to respect the ARCHITECTURE.md rule that Booking Engine does not own payment capture and should not need to know Payments' internals)
- Implement the manual partial-refund action referenced above as POST /api/v1/bookings/:bookingId/partial-refund, guarded by requireBusinessPermission('can_view_payouts') or a more specific can_issue_refunds flag if the team prefers finer granularity, validating the requested amount does not exceed the originally captured deposit
- Implement the automatic-refund path referenced by Prompt 9.2's expired-hold race condition as a direct call to processRefund(bookingId, 'full') from that webhook handler
- Write integration tests covering: full refund on a within-window cancellation, forfeiture (no refund, marked for payout) on an outside-window cancellation or no-show, a manual partial refund within the valid amount range, and rejection of a partial refund request exceeding the captured amount
```

**Expected Output:** A `processRefund` function handling all three refund categories, an event-based (not direct-import) integration with Chapter 7's cancellation/no-show outcomes respecting module boundaries, a manual partial-refund endpoint, and passing tests for all listed scenarios.

**Success Criteria:**

- A cancellation within the policy window (per Chapter 6/7's logic) results in a full Stripe refund, verified in test mode
- A no-show or outside-window cancellation results in the deposit marked `forfeited`, with no refund issued, and confirmed still present in `payments` for later payout inclusion
- A manual partial refund request exceeding the original captured amount is rejected with a clear validation error
- The Booking Engine → Payments integration is confirmed, via code review, to use an event/callback mechanism rather than a direct cross-module function import, respecting `ARCHITECTURE.md`'s boundary rules

**Dependencies:** Prompt 9.2, Chapter 7 (Prompt 7.4)

---

### Prompt 9.4 — Webhook Handling with Idempotency

**Category:** Payments — Reliability Hardening
**Objective:** Perform a dedicated audit and hardening pass over every Stripe webhook handler built in this chapter so far (Prompts 9.1-9.3), explicitly verifying each one strictly follows Chapter 2's four-step webhook sequence, since this is the single highest-consequence category of bug in the payments chapter.

**Context:** Requires Prompts 9.1, 9.2, and 9.3. This is a dedicated hardening/audit prompt, similar in spirit to Chapter 3's Prompt 3.6 (auth rate-limiting audit).

**Prompt:**

```
Perform a dedicated audit and hardening pass on every Stripe webhook handler implemented in this chapter (account.updated from Prompt 9.1, payment_intent.succeeded and payment_intent.payment_failed from Prompt 9.2, and any refund-related webhook events relevant to Prompt 9.3, such as charge.refunded), verifying and correcting as needed against Chapter 2's documented four-step sequence: signature verification first, idempotency check second, business logic third, processed-record write last (only after success).

Requirements:
- For each handler, explicitly verify: signature verification happens before any payload parsing or business logic, using Stripe's official signature-verification method against the raw request body (not a re-serialized/parsed version of it, which can produce a different signature)
- For each handler, explicitly verify: the idempotency check against processed_webhook_events happens immediately after signature verification and before any state-mutating logic runs
- For each handler, explicitly verify: the processed_webhook_events record is written only after the handler's business logic completes successfully, so that a mid-processing crash results in a safe retry (Stripe will redeliver) rather than a false "already processed" state that permanently skips a needed action
- Add explicit handling for out-of-order webhook delivery: if a payment_intent.payment_failed event is somehow received after a payment_intent.succeeded event for the same PaymentIntent has already been processed (a known possibility with at-least-once, not-strictly-ordered delivery), the handler must check current payments row status before blindly applying the failed-state update, and must not regress an already-captured payment back to failed
- Add a reconciliation script (not necessarily a recurring job — a manually triggerable admin script is acceptable at this stage) that compares a sample of recent payments rows against Stripe's actual PaymentIntent status via the Stripe API, flagging any discrepancy for manual review, as a safety net against any webhook processing gap this audit may not have caught
- Write a dedicated security/reliability test suite, src/modules/payments/webhook-hardening.test.ts, explicitly testing: rejection of an invalid-signature payload for each handler, correct short-circuit behavior on a replayed event ID for each handler, and the out-of-order failed-after-succeeded scenario correctly leaving the payment in its captured state
```

**Expected Output:** An audited and, where necessary, corrected set of webhook handlers strictly following the four-step sequence, explicit out-of-order-delivery protection, a manual reconciliation script, and a dedicated hardening test suite covering all listed scenarios.

**Success Criteria:**

- Every webhook handler in the chapter is confirmed, via the new test suite, to reject invalid signatures and correctly short-circuit on replayed event IDs
- The out-of-order test (a failed event arriving after a succeeded event for the same PaymentIntent) is confirmed to leave the payment's status as `captured`, not regressed to `failed`
- The reconciliation script successfully identifies a deliberately-introduced discrepancy (e.g., a test payments row manually set to an incorrect status) when run against Stripe's test-mode API

**Dependencies:** Prompts 9.1, 9.2, 9.3

---

### Prompt 9.5 — Payout Scheduling and Reporting

**Category:** Payments — Stylist Payouts
**Objective:** Implement the scheduled payout process that pays stylists their earned deposits (net of any platform subscription fee, per the pitch's flat-subscription-first business model) and gives them a clear income report.

**Context:** Requires Prompt 9.1 (Stripe Connect account) and Prompts 9.2-9.3 (captured/forfeited deposit data to pay out). Since the business model established in the pitch is a flat subscription rather than a take-rate at this stage, payouts here are full deposit amounts, not commission-adjusted amounts — document this clearly as a point that will need revisiting if a take-rate model is introduced later (Chapter 25, Future Features).

**Prompt:**

```
Implement stylist payout scheduling and reporting in src/modules/payments/.

Requirements:
- Rely on Stripe Connect's built-in payout scheduling (e.g., automatic daily or weekly payouts to the stylist's connected bank account, configured at the Connect account level) rather than building custom payout-timing logic — this platform's business model (per the current flat-subscription approach, not a take-rate) means the platform does not need to hold and later disburse a stylist's captured deposits with custom logic; captured deposits already flow to the stylist's connected account balance directly if configured with the appropriate Stripe Connect charge type (document and confirm the charge type — e.g., "destination charges" or "direct charges" — used in Prompt 9.2 supports this, and adjust if it does not)
- Implement GET /api/v1/businesses/me/payouts, guarded by requireBusinessPermission('can_view_payouts'), returning a stylist's payout history by querying the Stripe API for their connected account's payout records, rather than maintaining a separate platform-side payout ledger that could drift from Stripe's actual records
- Implement GET /api/v1/businesses/me/income-report, guarded the same way, aggregating the platform's own payments table (captured, forfeited, refunded deposits over a stylist-selectable date range) into a summary report (total captured, total forfeited-and-retained, total refunded, count of completed vs. no-show bookings) — this is derived reporting from data the platform already owns, distinct from the Stripe-sourced payout history above
- Explicitly document, in a code comment and in a new docs/BUSINESS_MODEL_NOTES.md, that this chapter's payout logic assumes the current flat-subscription model with no platform take-rate on deposits; if a future take-rate/commission layer is introduced (per Chapter 25's Future Features), this prompt's Stripe charge-type configuration and payout logic will need to be revisited to correctly deduct the platform's commission before or during payout, rather than assumed away
- Write integration tests, using Stripe test mode, covering: payout history retrieval reflecting test-mode payout records, and income-report aggregation correctly summing captured/forfeited/refunded amounts over a test date range
```

**Expected Output:** Confirmed/configured Stripe Connect charge-type supporting direct payout flow, a payout-history endpoint sourced from Stripe directly, an income-report endpoint aggregating the platform's own payments data, and explicit documentation flagging the take-rate revisit point for later, with passing tests.

**Success Criteria:**

- Payout history is confirmed to be sourced live from Stripe's API, not a separately maintained and potentially drifting platform ledger
- The income report correctly aggregates captured, forfeited, and refunded totals over a test date range against seeded test data
- `docs/BUSINESS_MODEL_NOTES.md` clearly flags that this chapter's implementation assumes no platform take-rate, and identifies exactly what would need to change if one is introduced

**Dependencies:** Prompt 9.1, Prompts 9.2, 9.3

---

### Prompt 9.6 — Chargeback/Dispute Evidence Handling

**Category:** Payments — Dispute Management
**Objective:** Implement automatic collection and packaging of evidence (booking confirmation, policy shown at time of booking, conversation history) to support a stylist when a client disputes a charge with their bank, per the Playbook's explicit requirement that this evidence trail be a product requirement, not just a payments afterthought.

**Context:** Requires Prompt 9.2 (payments/bookings linkage) and forward-depends on Chapter 11 (Messaging/conversation history) and Chapter 13 (AI Receptionist conversation records) for full evidence richness — implement this prompt's structure now with a documented extension point for those chapters' data once built.

**Prompt:**

```
Implement chargeback/dispute evidence handling in src/modules/payments/.

Requirements:
- Implement the Stripe webhook handler for charge.dispute.created, following Chapter 2's conventions exactly (signature verification, idempotency via processed_webhook_events), which triggers automatic evidence packaging rather than requiring a stylist or admin to manually assemble it under time pressure (Stripe disputes have a firm response deadline)
- Implement an assembleDisputeEvidence(bookingId) function that gathers: the booking record and its state-transition history (if Chapter 7 maintains one, or derivable from created_at/cancelled_at fields), the policy that was in effect at the time of booking (note: if Chapter 6's policy is mutable and doesn't currently version historical values, flag this here as a gap — ideally the deposit/cancellation policy values should be snapshotted onto the booking record itself at creation time, rather than only referencing the current live policy; if Chapter 7's bookings table does not already store a snapshot, add a policy_snapshot jsonb column to bookings now via a migration, and note that Chapter 7's booking-creation logic should be revisited to populate it going forward), and — with an explicit extension point commented in the code — a placeholder for conversation history that Chapter 11/13 will populate once those chapters exist
- Add a dispute_evidence_packages table: id, payment_id (FK), booking_id (FK), assembled_at, submitted_to_stripe_at (nullable), evidence_data (jsonb)
- Implement automatic submission of the assembled evidence to Stripe's Dispute API where the evidence is sufficiently complete, or flag for manual stylist/admin review (via the Admin Panel, Chapter 19) when key evidence (e.g., conversation history, before those chapters exist) is missing
- Write integration tests covering: successful evidence assembly for a booking with a policy snapshot present, and correct detection/flagging of a booking lacking a policy snapshot (simulating the case of a booking created before this fix was in place, or before Chapter 7 is updated to populate it)
```

**Expected Output:** A dispute webhook handler following Chapter 2's conventions, an evidence-assembly function with an explicit extension point for future conversation-history data, a `policy_snapshot` addition to `bookings` (flagging the retroactive gap for existing bookings), a `dispute_evidence_packages` table, and passing tests for both the complete and incomplete evidence cases.

**Success Criteria:**

- A simulated dispute event correctly triggers evidence assembly without manual intervention, verified by test
- A booking with a `policy_snapshot` populated produces a complete evidence package; one without it is correctly flagged as incomplete rather than silently submitted with a gap
- Code comments and `docs/PAYMENTS_INTEGRATION.md` clearly mark the conversation-history extension point for Chapter 11/13 to fill in later, and explicitly flag that Chapter 7's booking-creation logic should be revisited to populate `policy_snapshot` going forward if it does not already do so

**Dependencies:** Prompt 9.2, Chapter 7 (bookings schema, flagged for a possible revisit), forward-reference to Chapters 11 and 13

---

## Chapter 9 Summary

At the end of this chapter, the platform can onboard stylists onto Stripe Connect, collect deposits tied to bookings, correctly confirm or refund based on Chapter 7's booking-state outcomes, has been through a dedicated webhook-hardening audit, pays stylists via Stripe's native payout mechanism with platform-side income reporting, and automatically assembles dispute evidence.

**Two explicit gaps are flagged for cross-chapter follow-up:** Prompt 9.5 documents that the current payout logic assumes no platform take-rate and must be revisited if Chapter 25's future commission model is built; Prompt 9.6 flags that Chapter 7's booking-creation logic should ideally be revisited to populate a `policy_snapshot` at booking time, and that full dispute-evidence quality depends on Chapters 11 and 13 populating the conversation-history extension point once they exist.

---

Ready to proceed to Chapter 10 (Reviews) when you are.
