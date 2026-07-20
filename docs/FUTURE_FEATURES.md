# Future Features (Chapter 25)

**Status:** Documentation only — **not a build target**  
**Source:** [prompt-library-chapter-25-future-features.md](../reference/prompt-library/prompt-library-chapter-25-future-features.md)  
**Back Matter:** Chapter 25 is intentionally excluded from the build order; it preserves deferred decisions and trigger conditions.

This document exists so a future session (months or years later) can pick up any item **without re-deriving why it was deferred** or what it depends on.

---

## How to use this doc

Before implementing any item below:

1. Confirm the **trigger condition** is genuinely met (not aspirational).
2. Re-read the linked chapter docs and codebase paths.
3. Treat 25.2, 25.4 (marketplace path), and 25.5 as **separate mini build-orders** — not single-prompt work.
4. For 25.4 and 25.5, complete the **strategic decision** step first; "don't build" is a valid outcome.

---

## Summary table

| Prompt | Feature                         | Stage           | Trigger (build when…)                                     | Complexity                      |
| ------ | ------------------------------- | --------------- | --------------------------------------------------------- | ------------------------------- |
| 25.1   | Waitlist                        | V2/V3           | Ch.18 analytics show cancellations create contested slots | Medium — extends Ch.7/12        |
| 25.2   | Multi-staff salons              | V3              | Demonstrated inbound demand from multi-chair salons       | High — mini build-order         |
| 25.3   | Take-rate / commission          | V3              | Subscription retention proven + real transaction volume   | High — revisits Ch.9            |
| 25.4   | Product / affiliate marketplace | Opportunistic   | Core business established; stylists request it            | Decision first; scope varies    |
| 25.5   | Training / course hosting       | Lowest priority | Clear stylist demand without diluting core product        | Strategic reconsideration first |

---

## 25.1 — Waitlist functionality

**Why deferred:** Low payoff before real booking volume; cancellations rarely create contested openings in early beta.

**Trigger:** Chapter 18 analytics (when built) shows meaningful waitlist demand from cancellation-driven slot releases.

**Builds on:**

| Chapter                | Code / docs                                                                |
| ---------------------- | -------------------------------------------------------------------------- |
| Ch.7 Booking           | `apps/api/src/modules/booking/` — state machine, holds, cancellation hooks |
| Ch.8 Availability      | `apps/api/src/modules/booking/availability.ts`                             |
| Ch.11/12 Notifications | `apps/api/src/modules/notifications/`, BullMQ jobs                         |
| Ch.13 Booking dispatch | Existing hold + deposit flow via receptionist                              |

**Implementation sketch (when triggered):**

- New `waitlist_entries` table (additive migration only).
- Subscribe to cancellation events from booking service (same pattern as Ch.9/12 hooks).
- Match opened slots → notify via existing notification infrastructure (FCFS).
- Claim window ~30 minutes; reuse Ch.7 hold/conflict logic ("first valid hold wins").
- Auto-expire entries when `desired_date_range` passes.

**Success criteria:** Cancellation → match → notify → first responder claims via existing `/bookings/holds` flow; unclaimed offers expire to next candidate or general availability.

---

## 25.2 — Multi-staff salon support

**Why deferred:** GTM targets solo independent braiders first (Blueprint).

**Trigger:** Demonstrated demand from multi-stylist salons (inbound signups, support tickets, or pilot requests).

**Foundation already in codebase:**

- `UserRole.stylist_staff`, `BusinessStaff`, `StylistMembership` — `prisma/schema.prisma`
- Permission guards — `apps/api/src/modules/roles/`, `docs/PERMISSIONS.md`
- **Phase 1 invite hardening (2026-07-20):** secure token invites (7-day expiry), Resend email provider, Team role presets (manager/stylist/receptionist), deactivate/remove UI, staff phone sign-in at `/login/team` (no email password) — still **one bookable calendar per business** (staff are dashboard helpers, not separate chairs). See [PERMISSIONS.md](./PERMISSIONS.md).

**Likely touch points (audit before building):**

| Area                           | Risk                                       |
| ------------------------------ | ------------------------------------------ |
| Ch.6 onboarding                | Assumes one owner = one calendar/pricing   |
| Ch.8 availability              | Per-`stylistId` today, not per staff chair |
| Ch.13 receptionist             | No staff-name resolution slot              |
| Ch.16/17 directory & dashboard | One listing per stylist profile            |
| Beta `/directory`              | Opt-in per `StylistProfile`                |

**Approach:** Own mini build-order (structure approval → per-staff availability → AI staff resolution → salon directory type). **No schema rewrite** if extending `BusinessStaff` / membership models suffices.

---

## 25.3 — Marketplace commission / take-rate

**Why deferred:** Pitch sequences monetization: prove subscription retention before adding a second revenue model.

**Trigger:** Proven subscription retention + material transaction volume (see [detailed-pitch.md](../reference/requirements/detailed-pitch.md)).

**Flagged in Ch.9:** Destination charges today assume platform is not taking a booking commission. See `docs/PAYMENTS.md` (9.5 deferred).

**Implementation sketch (when triggered):**

| Area              | Change                                                                                      |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Stripe Connect    | Likely switch to application-fee-on-destination-charge — `apps/api/src/lib/stripe/`         |
| Rate config       | `commission_rate` field (platform-wide or per-stylist cohort) — mirror Ch.6 deposit pattern |
| Stylist reporting | Gross / commission / net as **three lines** — `apps/web/src/app/stylist/payments/`          |
| Platform metrics  | `platform_commission_revenue` — requires Ch.18                                              |
| Webhooks          | Full re-audit of Ch.9.4 idempotency after charge-type change                                |

**Success criteria:** Transparent stylist income breakdown; webhook re-audit passes; commission tracked separately from gross GMV.

---

## 25.4 — Product / affiliate marketplace

**Why deferred:** Different product surface from core booking + AI receptionist.

**Trigger:** Core loop stable; stylists explicitly request product recommendations / affiliate revenue.

**Decision required before any code:**

| Model                | Scope                                                   | Payment infra                         |
| -------------------- | ------------------------------------------------------- | ------------------------------------- |
| **Affiliate links**  | Profile-attached recommendations + outbound tracking    | None new — extends Ch.6 profile       |
| **Full marketplace** | Inventory, fulfillment, separate Stripe product charges | New multi-chapter build-out ("Ch.26") |

**Do not conflate the two paths.** Document decision in this file with date + reasoning when made.

**Affiliate path (if chosen):** Extend `apps/api/src/modules/profile/`, stylist profile web UI — no Ch.9 changes.

---

## 25.5 — Training / course hosting

**Why deferred:** Arguably a different product; lowest priority in Ch.25.

**Trigger:** Clear stylist demand **and** conviction it won't dilute the booking/AI core.

**Strategic reconsideration first:** Build natively vs. affiliate/referral to existing course platforms (Teachable, etc.) — same pattern as 25.4's decision gate.

**If pursued natively:** Requires new video storage/streaming, course purchase flow (distinct from deposit charges), and access-control — **own chapter structure**, not this prompt alone.

**Valid outcome:** Document "refer out, don't build" and close the item.

---

## Cross-references

| Doc                                                                              | Relevance                              |
| -------------------------------------------------------------------------------- | -------------------------------------- |
| [product-blueprint.md](../reference/requirements/product-blueprint.md) § roadmap | V3 items gated by trigger              |
| [back-matter.md](../reference/prompt-library/back-matter.md) § V3 milestone      | When to revisit Ch.25 items            |
| [PAYMENTS.md](./PAYMENTS.md)                                                     | Take-rate touches Ch.9                 |
| [BOOKING.md](./BOOKING.md)                                                       | Waitlist touches Ch.7                  |
| [BUILD_PROGRESS.md](../BUILD_PROGRESS.md)                                        | MVP complete; V2/V3 tracked separately |
| [GOOGLE_REVIEWS.md](./GOOGLE_REVIEWS.md)                                         | Phase 1 placeholders; Phase 2 import   |

---

## Opportunistic — Google Reviews import

**Why deferred:** Blueprint marks Reviews as V2; Phase 1 only stores Place ID / GBP URL placeholders.

**Trigger:** Pilot stylists request Google social proof on directory or booking pages; Google API access approved.

**Builds on:** `StylistProfile.googlePlaceId` / `googleBusinessProfileUrl` / `googleReviewsLinkedAt` (see [GOOGLE_REVIEWS.md](./GOOGLE_REVIEWS.md)).

**Do not build until trigger:** review sync jobs, star badges, or scraped ratings.

---

## MVP handbook complete

Chapters 1–24 delivered the MVP build. Chapter 25 closes the prompt library as **preserved context**, not queued implementation. Next engineering work should follow Back Matter milestones (beta ship checklist, Ch.20–22 when scheduled, or a specific Ch.25 item once its trigger is met).
