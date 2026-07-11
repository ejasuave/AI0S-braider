# Chapter 25 — Future Features

## Overview

This chapter documents capabilities deliberately deferred throughout this library — referenced in the original pitch's broader monetization ideas, in the Engineering Playbook's "Future Improvements" sections, and in explicit forward-references made by earlier chapters in this library itself (Chapter 9's take-rate note, Chapter 16's waitlist idea) — written with enough context that a future session, potentially years into this project, can pick any of them up without needing to re-derive the reasoning for why they were deferred or what they'd need to build on.

## Why This Chapter Exists

A multi-year build handbook is only as useful as its ability to prevent context loss over time — without this chapter, a future decision to finally build, say, a take-rate commission layer would require re-discovering that Chapter 9 already flagged exactly what would need to change, or re-deriving from scratch why a waitlist feature makes more sense after Chapter 16's Directory has real usage data than before. This chapter exists to be that preserved context, explicitly connecting each deferred feature back to the specific prompts and design decisions it depends on.

## Prompts in This Chapter

25.1 Waitlist functionality
25.2 Multi-staff salon support expansion
25.3 Marketplace commission/take-rate layer
25.4 Product/affiliate marketplace
25.5 Training/course hosting for stylists

---

### Prompt 25.1 — Waitlist Functionality

**Category:** Future Features — Booking Enhancement
**Objective:** When a client wants a slot that isn't currently available, let them join a waitlist and be automatically offered the slot if it opens up via a cancellation — explicitly flagged as a Future Improvement in Chapter 7's own chapter summary.

**Context:** Builds directly on Chapter 7 (bookings and cancellation events), Chapter 8 (availability computation), and Chapter 12 (notification delivery). This feature was explicitly deferred because it's meaningfully more valuable once the platform has enough real booking volume that cancellations creating genuinely contested openings are common — before that point, it's speculative complexity with little payoff.

**Prompt:**

```
[FUTURE — implement only once Chapter 7's booking volume data (via Chapter 18's analytics) shows cancellations creating meaningful contested-slot demand, not before]

Implement waitlist functionality, extending Chapter 7's Booking Engine and Chapter 12's Notifications module.

Requirements:
- Add a waitlist_entries table: id, business_id (FK), client_id (FK), desired_date_range, desired_service_offering_id (FK, nullable), created_at, notified_at (nullable), expired_at (nullable)
- Subscribe to Chapter 7's cancellation event (the same event/callback pattern used since Chapter 9) to check, whenever a confirmed booking is cancelled, whether any waitlist_entries match the newly-opened slot's business, date range, and service
- Notify matching waitlisted clients via Chapter 11/12's existing notification infrastructure, on a first-come-first-served basis (the first client to respond and complete the deposit flow, per Chapter 13's existing booking flow, gets the slot — do not attempt to build a new allocation mechanism when Chapter 7's existing hold/conflict-detection logic already correctly handles "first valid hold wins")
- Set a reasonable expiry on both the waitlist entry itself (e.g., auto-expire after the desired date range passes) and on the notification-to-response window (e.g., a waitlisted client has 30 minutes to claim the slot before it's offered to the next person on the list or opened to general availability)
- This is additive to Chapter 7 and Chapter 12's existing schemas and events — no existing table or function signature should need to change to support this
```

**Expected Output:** A waitlist feature reusing Chapter 7's existing cancellation events and hold/conflict logic, and Chapter 11/12's existing notification infrastructure, with no changes required to those chapters' existing contracts.

**Success Criteria:** A cancellation correctly triggers waitlist matching and notification; the first waitlisted client to respond successfully claims the slot through the existing booking flow; an unclaimed notification correctly expires and moves to the next candidate or releases the slot.

**Dependencies:** Chapter 7, Chapter 8, Chapter 11, Chapter 12, Chapter 18 (for the usage-data trigger determining when to build this)

---

### Prompt 25.2 — Multi-Staff Salon Support Expansion

**Category:** Future Features — Business Model Expansion
**Objective:** Extend the platform beyond individual independent stylists to small salons with multiple chairs/stylists operating under one shared booking presence, building on the multi-staff permission foundation already established in Chapter 4.

**Context:** Chapter 4 deliberately built `businesses` and `business_staff` as separate concepts from day one specifically to make this expansion possible without a schema rewrite — this prompt is the natural continuation of that early design decision, deferred because the pitch's initial go-to-market deliberately targets solo independent professionals first, not salons.

**Prompt:**

```
[FUTURE — implement once there is demonstrated demand from multi-stylist salons, not as part of the initial solo-stylist-focused launch]

Extend multi-staff salon support beyond Chapter 4's foundational permission model.

Requirements:
- Chapter 4's business_staff table and permission-flag system already support multiple staff per business — audit whether any assumption elsewhere in the codebase (Chapter 6's onboarding flow, Chapter 17's dashboard) implicitly assumes a single stylist per business_id and would need adjustment for a salon where multiple staff each have their own calendar, pricing, and portfolio within one shared business entity
- Extend Chapter 8's availability engine to compute availability per staff member within a business, not just per business, since a salon's clients need to book a specific stylist's chair, not just "the salon's" undifferentiated availability
- Extend Chapter 13's AI Receptionist to resolve which specific staff member a client wants (by name, or by style specialty if the client doesn't have a preference) as an additional slot to extract, before proceeding to Chapter 8's now-per-staff availability lookup
- Extend Chapter 16's search/directory to support salons as a distinct listing type (a business with multiple staff, each potentially with their own portfolio) rather than assuming every directory listing represents exactly one stylist
- This is a genuinely significant expansion touching Chapters 6, 8, 13, and 16 — approach it as its own dedicated mini-build-order (structure-approval-first, then one component at a time, consistent with this library's own established working pattern) rather than a single prompt
```

**Expected Output:** Per-staff availability and booking within a shared business entity, AI Receptionist staff-resolution as an additional conversational slot, and salon-aware directory listings — extending, not replacing, Chapters 4, 6, 8, 13, and 16's existing foundations.

**Success Criteria:** A salon business with multiple staff members can be searched, booked, and managed with each staff member's own calendar and specialties correctly distinguished; Chapter 4's existing permission model requires no schema changes to support this, only new consumption of data it already models.

**Dependencies:** Chapter 4 (foundational), Chapter 6, Chapter 8, Chapter 13, Chapter 16

---

### Prompt 25.3 — Marketplace Commission/Take-Rate Layer

**Category:** Future Features — Business Model
**Objective:** Introduce a platform take-rate/commission on bookings, as an addition to (or eventual partial replacement of) the flat-subscription-only model established in the original pitch and implemented throughout Chapter 9.

**Context:** Chapter 9's Prompt 9.5 explicitly flagged this exact gap: "if a future take-rate/commission layer is introduced, this prompt's Stripe charge-type configuration and payout logic will need to be revisited to correctly deduct the platform's commission before or during payout, rather than assumed away." This prompt is that flagged revisit.

**Prompt:**

```
[FUTURE — implement only once subscription retention is proven and real transaction volume exists, per the original pitch's explicit business-model sequencing: prove one revenue model before adding a second]

Introduce a marketplace commission/take-rate layer, revisiting Chapter 9's payout logic exactly as that chapter's own Prompt 9.5 flagged.

Requirements:
- Revisit Chapter 9's Stripe Connect charge-type configuration (Prompt 9.2) — a take-rate model likely requires switching from a direct-charge pattern to an application-fee-on-destination-charge pattern (or equivalent), so the platform's commission is deducted automatically at the point of charge rather than requiring separate reconciliation
- Add a commission_rate field (percentage or flat, per the same deposit_type pattern established in Chapter 6's Prompt 6.5 for consistency) — decide whether this is platform-wide or per-business (e.g., an introductory-rate cohort of early adopters), and document the decision
- Revisit Chapter 9's Prompt 9.5 income-report function to correctly show the stylist their gross revenue, the platform's commission deducted, and their net payout as three distinct figures — do not silently fold the commission into a single opaque number, since transparency here directly affects stylist trust
- Revisit Chapter 18's Prompt 18.2 platform-metrics rollup to add a distinct platform_commission_revenue metric, separate from the gross booking volume it's already tracking
- This changes a foundational financial assumption threaded through Chapter 9's entire implementation — treat this with the same care as any of Chapter 9's original prompts, including a full re-run of Chapter 9's Prompt 9.4 webhook-hardening audit against the modified charge flow
```

**Expected Output:** A revisited Stripe charge-type configuration correctly deducting platform commission, transparent stylist-facing gross/commission/net reporting, updated platform-level commission-revenue metrics, and a re-audited webhook-hardening pass against the modified flow.

**Success Criteria:** A stylist's income report clearly and separately shows gross revenue, commission deducted, and net payout; the webhook-hardening re-audit confirms no idempotency or race-condition regression was introduced by the charge-type change; platform-wide commission revenue is correctly tracked as its own metric.

**Dependencies:** Chapter 9 (Prompts 9.2, 9.4, 9.5 specifically), Chapter 6 (Prompt 6.5, for the rate-field pattern), Chapter 18 (Prompt 18.2)

---

### Prompt 25.4 — Product/Affiliate Marketplace

**Category:** Future Features — Revenue Expansion
**Objective:** Let stylists sell or affiliate-link hair-care products (extensions, hair care, aftercare kits) referenced in the original pitch's broader monetization brainstorm, as a genuinely separate feature from the core booking business.

**Context:** This was one of several monetization ideas raised early in the project's pitch discussion, explicitly deferred at the time in favor of focusing the initial build on one revenue model (subscription) and one core loop (booking). It has no dependency on any specific existing chapter's data model, unlike Prompts 25.1-25.3, since it's a genuinely new domain rather than an extension of booking/payments logic.

**Prompt:**

```
[FUTURE — low priority relative to Prompts 25.1-25.3, since this is a materially different product surface from the core booking/AI-receptionist value proposition this platform is built around; only pursue once the core business is well-established and stylists themselves are requesting this specific capability]

Implement a product/affiliate marketplace feature for stylists.

Requirements:
- Decide, as a first-class product decision requiring its own dedicated strategy discussion (not something to decide implicitly while writing code), between two fundamentally different models: (a) an affiliate-link model, where the platform earns a referral commission on products sold through external retailers, requiring minimal new infrastructure, versus (b) a genuine marketplace model, where the platform itself facilitates product sales, requiring new inventory, shipping/fulfillment, and a materially more complex Stripe integration (product charges distinct from Chapter 9's service-deposit charges) — these are very different scopes of work and should not be conflated
- If pursuing the affiliate model: this requires no new payment infrastructure, only a new content-management surface (product recommendations attached to a stylist's profile, per Chapter 6's existing profile module) and outbound affiliate-link tracking
- If pursuing the marketplace model: this requires substantially more new infrastructure than any single prompt in this library, and should be scoped as its own multi-chapter addition to this handbook (its own "Chapter 26"-equivalent build-out), not squeezed into a single Future Features prompt
- Given the significant scope difference between these two paths, do not proceed with implementation until this decision is explicitly made and documented, since the two paths share almost no common foundation
```

**Expected Output:** An explicit, documented product-vs-affiliate model decision, and — depending on that decision — either a lightweight affiliate-link feature or the initiation of a properly-scoped new multi-chapter build-out.

**Success Criteria:** The model decision is documented with clear reasoning before any implementation begins; if the affiliate path is chosen, it's confirmed to require no new payment infrastructure; if the marketplace path is chosen, it's confirmed to be scoped as its own dedicated build-out rather than compressed into this single prompt.

**Dependencies:** Chapter 6 (for the affiliate-model path only), none from this library for the marketplace-model path, which is genuinely new scope

---

### Prompt 25.5 — Training/Course Hosting for Stylists

**Category:** Future Features — Revenue Expansion
**Objective:** Let stylists host and sell tutorials, online classes, or mentorship content through the platform, another item from the original pitch's monetization brainstorm, explicitly deferred as being a materially different product from the core booking business.

**Context:** Like Prompt 25.4, this has no dependency on the core booking/AI chapters' data models — it's a genuinely separate content/commerce feature. It's listed last in this chapter as the lowest-priority deferred item, since it's furthest from the platform's core "AI receptionist for hair professionals" identity.

**Prompt:**

```
[FUTURE — lowest priority item in this chapter; this is arguably a different product than the one this entire library was built around, and should only be pursued if there's clear stylist demand and it doesn't dilute focus on the core booking/AI receptionist value proposition]

Implement training/course hosting for stylists.

Requirements:
- Before any implementation, explicitly revisit whether this belongs on this platform at all, versus being a feature better served by pointing stylists to existing dedicated course-hosting platforms with an affiliate/referral relationship (similar to the product-vs-affiliate decision in Prompt 25.4) — document this strategic reconsideration first
- If pursued natively: this would require new content-hosting infrastructure (video storage/streaming, materially different from Chapter 6's portfolio-image storage), a new payment flow distinct from Chapter 9's deposit-based service charges (a one-time or subscription course-purchase charge), and a new content-delivery/access-control system entirely separate from anything built in Chapters 1-24
- Given the size and novelty of this scope relative to everything else in this library, treat this — like Prompt 25.4's marketplace path — as warranting its own dedicated, separately-scoped build-out with its own chapter structure, table of contents, and approval process, rather than a single prompt within this Future Features chapter
- Do not begin implementation from this prompt alone; treat this prompt as the trigger for a "should we build this, and if so, how" strategy conversation, mirroring how this entire prompt library itself began with a strategy and pitch discussion before any engineering documentation was written
```

**Expected Output:** A documented strategic reconsideration of whether this feature belongs on the platform at all, and, if pursued, the initiation of a properly-scoped, separate build-out rather than an attempt to implement it from this single prompt.

**Success Criteria:** The strategic reconsideration is documented before any code is written; if pursued, it's confirmed to be scoped as its own dedicated chapter structure rather than compressed into this prompt, consistent with how Prompt 25.4's marketplace path was handled.

**Dependencies:** None from this library — genuinely new scope, if pursued at all

---

## Chapter 25 Summary

This chapter deliberately does not conclude with a "ready to build" posture the way every prior chapter has — its purpose is to preserve context for decisions explicitly deferred, not to queue up more implementation work. Two of its five items (Prompts 25.1 and 25.3) are natural, well-scoped extensions of foundations already built (Chapter 7/8/12 for waitlist, Chapter 9 for take-rate) and can be picked up relatively directly when their triggering conditions are met. One item (Prompt 25.2) is a significant expansion warranting its own mini build-order. Two items (Prompts 25.4 and 25.5) are genuinely different products from the platform's core identity and are flagged as needing their own strategic reconsideration — potentially concluding "don't build this" — before any engineering work begins.

**The single most important thing this chapter preserves is the reasoning for deferral, not just the list of deferred features.** A future session (or future founder) revisiting this chapter years from now should be able to understand not just what was deferred, but why, and what specifically would need to be true (proven retention, demonstrated demand, real usage data from Chapter 18's analytics) before picking each item up — preventing the common failure mode of a mature product re-litigating decisions its own earlier documentation had already carefully reasoned through.

---

All 25 chapters are now complete. Ready to proceed to the Back Matter (Complete Build Order, MVP/V2/V3 Classification, Never-Skip List, Common Mistakes, Best Practices, Dependency Map, and New-Chat-vs-Continue-Chat Guidance) when you are.
