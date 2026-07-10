# Back Matter
## The Complete Operating Manual — Build Order, Roadmap, Metrics, and Founder Guidance

This section extends beyond a technical appendix. It is written to function as the closing chapters of a professional engineering and startup operations manual — the reference a founder returns to not just when deciding which prompt to run next, but when planning a quarter, setting a KPI target, or deciding what to say no to. It supersedes the earlier draft back matter and should be treated as the definitive version.

**Contents**
1. Complete Build Order
2. MVP, Version 2, and Version 3 Roadmap
3. Prompt Dependency Map
4. Required vs. Optional Prompts
5. Best Practices for Claude Code and Cursor
6. Common Mistakes
7. Development Workflow
8. Production Readiness Checklist
9. Startup Development Milestones
10. Revenue Roadmap
11. Success Metrics & KPIs
12. Final Founder Guidance

---

## 1. Complete Build Order

### The sequence

| Stage | Chapters | Why it sits here |
|---|---|---|
| 1. Foundation | 1, 2 | Every later prompt assumes these conventions exist. Building anything before this means re-deriving folder structure, API shape, and error handling ad hoc, per-chapter — the exact inconsistency this library exists to prevent. |
| 2. Identity | 3, 4 | Almost everything from Chapter 5 onward is guarded by role/permission checks. Building features before identity exists means retrofitting auth into code that assumed an open system. |
| 3. Domain data | 6 (Chapter 5 is optional at this stage — see Section 2) | Chapter 6's structured pricing taxonomy is a hard prerequisite for the AI Receptionist (Chapter 13) to quote prices deterministically rather than hallucinating them. This must exist before Chapter 13, not be retrofitted after. |
| 4. Transactional core | 7, 8, 9 | The booking state machine, availability engine, and payments must exist together — Chapter 9's refund logic depends on Chapter 7's cancellation contracts; Chapter 8's availability depends on Chapter 7's conflict detection. |
| 5. Communication substrate | 11, 12 | Chapter 13 cannot be built without a messaging channel and escalation mechanism to send through and hand off to. |
| 6. The core differentiator | 13 (then 14, 15) | This is the product. Chapters 14 and 15 are additive extensions of 13's structured-output pattern, not independent systems — building them before 13 exists is not possible. |
| 7. Discovery and control surfaces | 16, 17 (10 fits here too) | Public discovery and dashboards are built once there's something real to discover and manage. |
| 8. Insight and operations | 18, 19 | Analytics and admin tooling are most useful once there's real usage data and real support cases to act on. |
| 9. Cross-cutting hardening | 20, 21, 22 | Deliberately last among the "before launch" chapters — auditing a system for security, performance, and test-coverage gaps is more meaningful once the full system exists to audit, not earlier. |
| 10. Ship | 23, 24 | Deployment and mobile polish close out the build. |

Chapter 25 is intentionally excluded — it is preserved context for deferred decisions, not a build target.

### Why this sequence is optimal

The ordering follows one governing rule: **a chapter is sequenced immediately after the last chapter whose output it consumes, and immediately before the first chapter that consumes its own output.** Chapter 6 comes before Chapter 13 because 13 consumes 6's pricing taxonomy. Chapter 9 comes after Chapter 7 because 9's refund logic consumes 7's cancellation-result contracts. This is why the sequence in this library is not arbitrary chapter-numbering — it is a topological sort of the dependency graph in Section 3, and deviating from it (e.g., attempting Chapter 13 before Chapter 6) means building against data that doesn't exist yet.

### Must-precede relationships that should never be violated

- **6.4 (structured pricing) before any of 13's dispatch prompts (13.4 onward).**
- **7.2 (concurrency-safe holds) before 9.2 (deposit capture)** — deposit capture assumes a hold already exists to attach payment to.
- **7.3/7.4 (booking contracts) before 9.2/9.3** — Chapter 9's payment logic is written specifically to consume these contracts.
- **11.1 (conversation schema) before any of 13.1 onward** — the AI Receptionist has nothing to read from or write to otherwise.
- **13.2 (structured-output contract) before 13.3 through 13.8** — every later prompt in that chapter depends on this validation layer existing.
- **13.6 (escalation policy) before 14.3** — Chapter 14 explicitly reuses 13.6's `shouldEscalate` function rather than building its own.

---

## 2. MVP, Version 2, and Version 3 Roadmap

This roadmap answers "when" — Section 4 answers a related but distinct question, "how essential." A chapter can be Version 2 in timing while still being Critical in the Section 4 sense (i.e., not optional forever, just not needed for the very first cohort).

| Chapter | Stage | Recommended timeline | Reasoning |
|---|---|---|---|
| 1. Project Setup | MVP | Week 1 | Nothing else can start without it |
| 2. Architecture | MVP | Week 1-2 | Same |
| 3. Authentication | MVP | Week 2-3 | Every account-bearing feature depends on it |
| 4. User Roles (4.1, 4.2 only) | MVP | Week 3 | Basic guards needed immediately; multi-staff (4.3) and impersonation (4.4) → V2 |
| 5. Customer Features | V2 | Month 5-6 | Core loop is conversational, not app-based |
| 6. Stylist Features (6.1, 6.2, 6.4-6.6) | MVP | Week 4-5 | Pricing taxonomy is a hard AI Receptionist dependency; Instagram import (6.3) → V2 |
| 7. Booking Engine | MVP | Week 5-6 | Transactional core |
| 8. Calendar & Availability (8.1, 8.3 only) | MVP | Week 6-7 | Core availability needed; Google Calendar sync (8.2, 8.4) → V2 once a stylist is trusting the platform as sole calendar |
| 9. Payments (9.1-9.5) | MVP | Week 7-8 | Deposit enforcement is the core value prop; dispute automation (9.6) → V2 |
| 10. Reviews | V2 | Month 6-7 | More valuable once Chapter 16 has public traffic |
| 11. Messaging (11.1, 11.2, 11.5 only) | MVP | Week 8-9 | SMS is the pitch's explicit first channel; WhatsApp/widget → V2 |
| 12. Notifications | MVP | Week 9 | Directly targets the no-show problem |
| 13. AI Receptionist | MVP | Week 9-13 | The product itself; budget the most time here of any chapter |
| 14. AI Hairstyle Recognition | V3 | Month 9+ | Explicit long-term moat, not a launch requirement |
| 15. AI Business Assistant | V2 | Month 6-7 | Explicit "Phase 2" in the original pitch |
| 16. Search | V2 | Month 6-8 | Explicit "tool first, marketplace second" sequencing |
| 17. Dashboards (17.1-17.3 only) | MVP | Week 13-14 | Stylist needs to see bookings and respond to escalations; client dashboard/real-time (17.4, 17.5) → V2 |
| 18. Analytics | V2 | Month 7-8 | Manual tracking suffices for a pilot cohort |
| 19. Admin Panel | V2 | Month 7-8 | Depends on chapters (9.6, 10, 18) that are themselves V2 |
| 20. Security (audit pass) | V2 | Month 5 (before public launch) | Post-MVP audit, but must precede any public/scaled launch |
| 21. Performance | V2 | Month 5-6 | Optimize against real usage, not guesses |
| 22. Testing (consolidation) | V2 | Month 5 | Per-prompt tests are already MVP; this is the gap-closing pass |
| 23. Deployment | MVP | Week 13-14 | Required to launch to real stylists at all |
| 24. Mobile Optimisation (24.1 only) | MVP | Week 14 | Baseline layout correctness; deeper polish → V2 |
| 25. Future Features | V3 / opportunistic | Triggered by specific conditions, not a date | See Chapter 25 |

**Rough timeline summary for a solo founder using AI-assisted development:** MVP in ~3-3.5 months (weeks 1-14), private beta with a pilot cohort of 10-20 stylists starting month 4, V2 features layered in over months 5-8 informed by real beta feedback, public launch around month 6-8 once Chapter 20's security audit and Chapter 22's hardening pass are complete, V3 (style recognition, take-rate model, salon expansion) pursued opportunistically once specific trigger conditions in Chapter 25 are met — not on a fixed calendar date.

---

## 3. Prompt Dependency Map

### Critical path

The critical path is the sequence that cannot be shortened by parallelizing, because each stage strictly blocks the next:

```
Ch1 → Ch2 → Ch3 → Ch4(4.1-4.2) → Ch6(pricing) → Ch7 → Ch9(9.1-9.2) → Ch11(11.1-11.2) → Ch13 → Ch23 → Launch
```

This is the longest pole in the tent. Chapter 13 (AI Receptionist) is the single largest segment of this path and should be budgeted the most calendar time of any chapter — see Section 2's timeline.

### Parallel development opportunities

Once their shared prerequisite is done, these pairs/groups have no dependency on each other and can be built concurrently (by different sessions, or in sequence without one blocking the other):

- **Chapter 5 vs. Chapter 6** (once Ch3/4 done) — customer features and stylist features don't depend on each other.
- **Chapter 8 vs. Chapter 9** (once Ch7 done) — availability and payments both consume Chapter 7's contracts but not each other's.
- **Chapters 10, 11, 12** (once their individual prerequisites are met) — reviews, messaging, and notifications are largely independent of each other.
- **Chapter 14 vs. Chapter 15** (once Ch13 done) — style recognition and the business assistant both extend Chapter 13 but don't depend on each other.
- **Chapter 18 vs. Chapter 19** (once Ch9/10 done) — analytics and admin tooling are independent.
- **Chapters 20, 21, 22** — explicitly independent audit passes.

### Independent features

These have minimal coupling to the rest of the system and can be deferred or picked up at any point without blocking anything else: Chapter 10 (Reviews), Chapter 18 (Analytics), Chapter 24's polish prompts (24.2-24.4), and everything in Chapter 25.

### High-risk implementation areas

Concentrate the most careful human review here, regardless of when they're built (cross-reference Section 4's "Critical" tier and the original chapters' own risk callouts):

- Chapter 7, Prompt 7.2 (concurrency-safe holds) — the double-booking guarantee.
- Chapter 9, Prompts 9.2-9.4 (deposit capture, refunds, webhook hardening) — real money.
- Chapter 13, Prompts 13.2, 13.6, 13.7 (structured output, escalation, injection resistance) — the AI's entire safety envelope.
- Chapter 4, Prompt 4.4 (impersonation) — if built, its denylist must be kept current against every sensitive route added later.
- Chapter 23, Prompt 23.3 (rollback and kill-switch) — your only lever during a live incident.

---

## 4. Required vs. Optional Prompts

This is a different cut than Section 2. Section 2 asks "when should this be built?" This section asks **"if resources were permanently constrained, would this product still have its core identity without this?"** A chapter can be Version 2 in timing while still Critical here — it just means "not needed on day one, but genuinely load-bearing once built."

| Tier | Definition | Chapters/prompts |
|---|---|---|
| **Critical** | The product has no viable identity without this — skipping it means you no longer have "an AI receptionist for hair professionals," you have something else | Ch1, Ch2, Ch3, Ch4 (4.1-4.2), Ch6 (6.4 pricing especially), Ch7, Ch9 (9.1-9.4), Ch11 (11.1, 11.2, 11.5), Ch12, Ch13, Ch23 |
| **Recommended** | Strongly strengthens trust, retention, or revenue; the core loop functions without it, but the business is meaningfully weaker | Ch4 (4.3-4.4), Ch6 (6.1-6.2, 6.5-6.6), Ch8, Ch9 (9.5-9.6), Ch10, Ch16, Ch17, Ch20, Ch21, Ch22, Ch24 (24.1) |
| **Optional** | Incremental polish with low cost of indefinite deferral | Ch5, Ch6.3 (Instagram import), Ch11 (11.3-11.4), Ch15, Ch18, Ch19, Ch24 (24.2-24.4) |
| **Future** | Explicitly out of scope until a specific trigger condition is met, per Chapter 25's own reasoning | Ch14, Ch25 in full |

---

## 5. Best Practices for Claude Code and Cursor

**How to structure prompts.** Follow this library's own format: state the objective, name the specific existing table/function/convention to reuse, list requirements as a checklist, and specify what "done" looks like. A prompt that doesn't name what already exists invites the assistant to invent a parallel version of it.

**How to maintain context.** Keep `ARCHITECTURE.md` and the relevant chapter's summary available to every session, either by having the assistant read them directly (preferred, since it can verify against the actual current file) or by pasting the specific relevant section into the prompt.

**When to continue an existing chat.** When working through prompts within the same chapter that build directly on each other turn by turn (e.g., Chapter 13's 13.1 through 13.6), or when iterating on something just generated in the current session.

**When to start a new chat.** When moving to a new chapter covering a different concern, when starting a dedicated audit/hardening prompt (9.4, 12.4, all of Chapter 20), or the moment you notice the assistant contradicting an established convention or forgetting a function signature it already created — that's context degradation, not just session length, and no amount of re-explaining fixes it as reliably as a fresh session with pointed context.

**How to avoid context drift.** Re-state the specific named contracts (Section 3's dependency map, Back Matter F's contract table from earlier chapters) a new session needs, rather than assuming it will rediscover them unprompted. Treat every chapter's own "why this chapter exists" framing as required reading for the assistant, not just for you — it's what lets the assistant make good judgment calls on the small decisions a prompt doesn't spell out explicitly.

**How to review AI-generated code.** Go through the prompt's own Success Criteria line by line against the actual generated code — don't just run the tests and assume passing tests mean the criteria are met. For the high-risk prompts in Section 3, read the code yourself; passing tests confirm the specified cases work, not that nothing else was subtly broken.

**How to keep documentation aligned with implementation.** Every `docs/*.md` file this library references (`ARCHITECTURE.md`, `API_CONVENTIONS.md`, `BOOKING_STATE_MACHINE.md`, and the rest) should be updated in the same prompt/commit that changes the behavior it describes — never as a separate, deferred "update the docs" pass. Documentation that lags implementation by even one chapter is worse than no documentation, because it's actively misleading to the next session that trusts it.

**How to prevent architectural drift.** Any time a prompt's output seems to introduce a new pattern (a new way of calling between modules, a new error-handling style) where an established one already exists, stop and check `ARCHITECTURE.md` before accepting it. Drift compounds — a small inconsistency accepted in Chapter 10 becomes the "second convention" a Chapter 17 session might copy instead of the correct one.

**How to minimise technical debt.** Don't skip a chapter's own hardening/audit prompts under time pressure (see Section 2's Critical tier) — debt taken on in Chapters 7, 9, and 13 specifically is expensive to repay later, because so much else is built on top of them by the time the cost becomes visible. If debt must be taken on somewhere, prefer taking it on in Optional-tier chapters (Section 4), which are cheaper to revisit in isolation.

---

## 6. Common Mistakes

**Mistake: Vague prompts inviting invented schema.**
*Why it happens:* It's faster to write "add reviews" than to specify the table shape, the reused permission flag, and the module boundary.
*Consequences:* Two chapters end up with two different shapes for a similar concept, discovered only when a third chapter tries to integrate both.
*How to avoid it:* Name the specific prior table, function, or convention to reuse in every prompt, exactly as this library does throughout.
*Best practice:* Treat "what does this reuse, and what does it deliberately not own" as a mandatory line in every prompt.

**Mistake: Skipping the "check existing conventions first" step.**
*Why it happens:* Under time pressure, reading `ARCHITECTURE.md` again feels like overhead.
*Consequences:* Silent duplication of logic that already exists elsewhere, discovered only during a later audit (Section 5's architectural-drift point).
*How to avoid it:* Make reading the relevant docs a non-skippable first step of every session, the same way this library's own computer-use conventions treat skill files as mandatory reading before any file creation.
*Best practice:* Point the assistant at the docs explicitly at the start of every prompt rather than assuming it remembers them from a prior session.

**Mistake: Accepting output without verifying against Success Criteria.**
*Why it happens:* The code runs, the happy path works, it feels done.
*Consequences:* Edge cases specified in the prompt (concurrency, race conditions, permission scoping) silently go unimplemented.
*How to avoid it:* Treat each prompt's Success Criteria as a literal checklist to verify, not a description of intent.
*Best practice:* Don't move to the next prompt until every criterion has been explicitly checked, not assumed.

**Mistake: Treating a long chat session as infinite context.**
*Why it happens:* It's convenient to keep working in the same thread.
*Consequences:* The assistant starts contradicting earlier decisions or forgetting exact function signatures it already created, and the resulting code silently drifts from what was actually built.
*How to avoid it:* Watch for the specific warning signs in Section 5 and start fresh proactively, not reactively.
*Best practice:* One chapter, roughly one session (with the parallelization exceptions noted in Section 1).

**Mistake: Skipping tests to move faster.**
*Why it happens:* Tests feel like they slow down visible progress.
*Consequences:* Regressions in exactly the areas (payments, concurrency, AI escalation) where a bug is most expensive to discover late.
*How to avoid it:* Treat the tests specified in every prompt as part of the deliverable, not an optional extra — this library wrote them into every single prompt for this reason.
*Best practice:* No prompt is "done" until its tests exist and pass, full stop.

**Mistake: Building the marketplace/discovery layer before proving the core tool.**
*Why it happens:* A public directory feels more like "a real product" than an internal tool a handful of pilot stylists use quietly.
*Consequences:* An empty or thin directory undermines trust with the very first clients who see it, per the pitch's own explicit warning.
*How to avoid it:* Follow Section 2's staging — Chapter 16 is V2 for a specific, reasoned purpose, not an oversight.
*Best practice:* Resist the temptation to build the more "demo-able" feature before the more load-bearing one.

**Mistake: Chasing every monetization idea simultaneously.**
*Why it happens:* More revenue ideas feel like more upside.
*Consequences:* None of them get properly proven, and the product's pricing/positioning becomes incoherent to the first paying stylists.
*How to avoid it:* Follow Section 10's staged revenue roadmap — one model proven before the next is introduced.
*Best practice:* Treat "which revenue stream is next" as a decision gated by evidence (retention, volume), not by founder enthusiasm.

**Mistake: Letting the AI Receptionist act autonomously before its escalation logic is solid.**
*Why it happens:* Full automation feels like the whole point of the product.
*Consequences:* A confidently wrong price quote or a manipulated response does more damage to trust than the AI simply admitting uncertainty would have.
*How to avoid it:* Never ship Chapter 13 without Prompts 13.6 and 13.7 fully built and tested — see Section 4's Critical tier.
*Best practice:* Treat "when does the AI defer to a human" as equally important as "what can the AI do," from the very first version.

---

## 7. Development Workflow

**Planning.** Every chapter in this library begins with structure-approval before content — apply the same discipline to any work beyond this library: outline before you build, get explicit sign-off on the outline, then build one piece at a time.

**Architecture.** Changes to service boundaries or cross-module conventions go through `ARCHITECTURE.md` first — update the document in the same change that alters the boundary, never after the fact.

**Database.** Follow Chapter 23's migration-safety practices for the life of the project: additive changes deploy freely; destructive changes (drops, renames, narrowing) are always split across multiple deploy cycles.

**Backend.** New features live in their own `src/modules/<feature>/` following Chapter 1's conventions; cross-module reads always go through the owning module's service layer, never direct table access.

**Frontend.** New features live in `src/features/<feature>/`, using the typed API client and TanStack Query conventions from Chapter 2 — no direct `fetch` calls in components.

**Testing.** Every prompt ships with its own tests (unit and integration) as a non-negotiable deliverable; Chapter 22's dedicated integration and end-to-end suites exist to close cross-chapter gaps, not to replace per-prompt tests.

**Deployment.** Follow Chapter 23: staging first (automatic on merge to main), production behind manual approval, with a drilled rollback mechanism and the AI Receptionist kill-switch ready before you need it.

**Maintenance.** Repeat Chapter 20's four-part audit (auth, PII, rate limits, dependencies) periodically, not just once — drift accumulates as new chapters and features are added by different sessions over a multi-year build.

**Scaling.** Follow Chapter 21's principle: optimize against real usage data (Chapter 18's analytics), not speculation — and never cache real-time availability or payment state, regardless of performance pressure.

### Git practices

- **Branching strategy:** a short-lived feature branch per prompt (or small, related group of prompts within one chapter), merged to `main` after review and CI passes — avoid long-lived branches that drift from `main` across multiple chapters' worth of changes.
- **Commit strategy:** one prompt, one commit (or a small, clearly-scoped set of commits) — per Section 5's guidance, this makes isolating which prompt introduced a regression trivial.
- **Release strategy:** tag a release at the end of each milestone in Section 9, not on an arbitrary calendar cadence — a release should correspond to a coherent, testable unit of new capability (e.g., "Booking System complete," "AI Receptionist complete"), matching this library's own chapter-as-unit-of-work philosophy.

---

## 8. Production Readiness Checklist

**Architecture**
- [ ] `ARCHITECTURE.md` accurately reflects every module's actual ownership boundaries
- [ ] No module queries another module's tables directly outside its documented service-layer interface

**Security**
- [ ] Chapter 20's four-part audit (auth, PII, rate limits, dependencies) completed at least once
- [ ] Impersonation denylist (if built) covers every sensitive route across every chapter

**Authentication**
- [ ] Session rotation and reuse detection tested (Chapter 3, Prompt 3.4)
- [ ] Rate limiting applied to every auth-adjacent endpoint, including newer ones (admin login, etc.)

**Payments**
- [ ] Every Stripe webhook handler audited against the four-step idempotent sequence (Chapter 9, Prompt 9.4)
- [ ] Reconciliation script run at least once against real or test-mode Stripe data

**AI**
- [ ] Structured-output validation (13.2) confirmed to reject every malformed-payload category tested
- [ ] Escalation confidence threshold (13.6) documented and tested as a hard override
- [ ] Adversarial/injection test suite (13.7) passing in full
- [ ] AI Receptionist kill-switch (23.3) drilled at least once

**Performance**
- [ ] Chapter 21's database and API latency baselines documented
- [ ] Availability computation confirmed never served from cache

**Accessibility**
- [ ] Touch-target sizing meets the documented minimum (Chapter 24, Prompt 24.2)
- [ ] No hover-dependent UI pattern remains on any touch-reachable surface

**SEO**
- [ ] Public stylist profile and search pages (Chapter 16) have correct metadata, structured data, and are crawlable
- [ ] Public pages' Core Web Vitals meet the documented mobile budget (Chapter 24, Prompt 24.3)

**Testing**
- [ ] Coverage baseline established (Chapter 22, Prompt 22.1) with high-risk-area gaps closed
- [ ] End-to-end suite (Chapter 22, Prompt 22.4) passing for all four critical journeys

**Monitoring**
- [ ] Structured logging and error tracking live in production (Chapter 1, Prompt 1.8)
- [ ] Synthetic latency monitoring configured for the three model-API-dependent endpoints (Chapter 21, Prompt 21.2)

**Logging**
- [ ] PII redaction confirmed consistent across every module (Chapter 20, Prompt 20.2)

**Analytics**
- [ ] Platform metrics rollup running daily (Chapter 18, Prompt 18.2)
- [ ] Booking funnel tracking confirmed accurate end to end (Chapter 18, Prompt 18.3)

**Error handling**
- [ ] Standard error envelope and codes used consistently across every endpoint (Chapter 2, Prompt 2.2)

**Backups**
- [ ] Database backup and restore process tested at least once, not just configured

**Compliance**
- [ ] STOP-keyword/opt-out chain verified end to end across all three modules it spans (Chapter 12, Prompt 12.4)
- [ ] Dispute-evidence assembly tested for both complete and incomplete cases (Chapter 9, Prompt 9.6)

**Deployment**
- [ ] Rollback drill completed and timed (Chapter 23, Prompt 23.3)
- [ ] Staging environment fully isolated from production, verified against its own checklist (Chapter 23, Prompt 23.2)

**Documentation**
- [ ] Every `docs/*.md` file referenced throughout this library exists and reflects current behavior

**Launch readiness**
- [ ] A pilot cohort of real stylists has used the AI Receptionist for at least several weeks with no unresolved P0/P1 incident

---

## 9. Startup Development Milestones

### M1 — Project Foundation
**Objective:** A reliable, conventions-driven development environment. **Deliverables:** Chapters 1-2 complete. **Features completed:** none user-facing. **Success criteria:** a new session can clone the repo and be running locally within Chapter 1's documented single-command sequence. **Estimated effort:** 1-2 weeks. **Exit criteria:** CI passes on a trivial change; `ARCHITECTURE.md` exists and is accurate.

### M2 — Core Infrastructure
**Objective:** Architectural conventions every feature will depend on. **Deliverables:** Chapter 2 complete (API conventions, shared types, background jobs, webhook handling). **Features completed:** none user-facing. **Success criteria:** the example ping endpoint and example background job both work end to end. **Estimated effort:** 1 week. **Exit criteria:** a new module can be added following documented conventions without inventing new patterns.

### M3 — Authentication & User Management
**Objective:** A secure identity and permission system. **Deliverables:** Chapters 3-4 complete. **Features completed:** signup, login (password/OTP/OAuth), roles, permission guards. **Success criteria:** all auth flows pass Chapter 3's security test suite. **Estimated effort:** 2-3 weeks. **Exit criteria:** a test user of each role can authenticate and is correctly scoped.

### M4 — Booking System
**Objective:** A working, concurrency-safe scheduling core. **Deliverables:** Chapters 6-8 complete (pricing taxonomy, booking engine, availability). **Features completed:** stylist onboarding, structured pricing, holds, confirmations, availability computation. **Success criteria:** the concurrency test (two simultaneous holds, exactly one succeeds) passes. **Estimated effort:** 3-4 weeks. **Exit criteria:** a booking can be created, held, and confirmed manually through the API without payment yet wired in.

### M5 — Payments
**Objective:** Reliable money movement. **Deliverables:** Chapter 9 complete. **Features completed:** Stripe Connect onboarding, deposit capture, refunds/forfeiture, payouts. **Success criteria:** the full webhook-hardening audit (9.4) passes. **Estimated effort:** 1-2 weeks. **Exit criteria:** a full test-mode booking-to-payout cycle completes correctly, including a cancellation-refund case.

### M6 — AI Receptionist
**Objective:** The product's core differentiator, working end to end. **Deliverables:** Chapters 11-13 complete. **Features completed:** SMS channel, conversation orchestration, structured-output-driven booking, escalation, injection resistance. **Success criteria:** the golden-set regression suite (13.8) and adversarial suite (13.7) both pass in full. **Estimated effort:** 4-5 weeks — budget the most time here of any milestone. **Exit criteria:** a real test conversation can go from "hi, I want knotless braids" to a confirmed, paid booking with zero manual intervention, and a deliberately adversarial message correctly escalates instead of succeeding.

### M7 — Public Beta
**Objective:** Real stylists using the real product. **Deliverables:** Chapters 17 (partial), 23, 24 (partial) complete. **Features completed:** minimal stylist dashboard, deployment pipeline, baseline mobile layout. **Success criteria:** 10-20 real pilot stylists onboarded and actively receiving AI-handled bookings from their existing clients. **Estimated effort:** 2 weeks build + 4-6 weeks of live beta. **Exit criteria:** at least one full week with no P0/P1 incident, and qualitative feedback confirming the core "stop answering 200 messages a week" value is actually being felt.

### M8 — Public Launch
**Objective:** Open the platform beyond a closed pilot cohort. **Deliverables:** Chapters 10, 16, 20, 21, 22 complete. **Features completed:** reviews, public search/directory, full security/performance/testing hardening. **Success criteria:** Section 8's Production Readiness Checklist fully checked off. **Estimated effort:** 4-6 weeks. **Exit criteria:** the platform can accept a new stylist signup with zero founder involvement, end to end.

### M9 — Growth
**Objective:** Deepen retention and expand revenue-adjacent capability. **Deliverables:** Chapters 5, 15, 18, 19, remaining 11/17 items complete. **Features completed:** client accounts, AI business assistant, analytics, admin panel, WhatsApp/real-time dashboard. **Success criteria:** MRR growth trend positive month over month (see Section 11). **Estimated effort:** ongoing, 2-3 months of focused work. **Exit criteria:** stylist churn trending down, repeat-client rate trending up.

### M10 — Scale
**Objective:** Build toward long-term defensibility and expanded monetization. **Deliverables:** Chapter 14, and Chapter 25 items as their specific trigger conditions are met. **Features completed:** style-recognition AI, possibly take-rate model, possibly multi-staff salon support. **Success criteria:** each Chapter 25 item's own documented trigger condition is genuinely satisfied before starting it (see that chapter's summary). **Estimated effort:** opportunistic, not calendar-driven. **Exit criteria:** N/A — this milestone is ongoing for the life of the company.

---

## 10. Revenue Roadmap

**Recommended order of introduction, and why:**

1. **Launch — flat monthly subscription.** Starter (free, limited bookings) / Pro / Premium tiers, per the original pitch. Simplest to sell, simplest to build, no commission disputes. Introduce at Public Beta (M7).

2. **Growth — AI premium features.** Once Chapter 14 (style recognition) exists, gate it behind the Premium tier as a clear, tangible reason to upgrade. Introduce at Scale (M10), tied directly to that chapter's own build trigger.

3. **Expansion — booking commission / take-rate.** Per Chapter 9 Prompt 9.5 and Chapter 25 Prompt 25.3's explicit sequencing: only after subscription retention is proven and real transaction volume exists. Do not introduce alongside the subscription at launch — prove one model before adding a second.

4. **Marketplace — featured listings.** Only once Chapter 16's directory has enough real stylist density that "featured" placement is actually worth paying for — a directory with ten listings has no competitive placement to sell.

5. **Enterprise / multi-location — salon subscription tier.** Per Chapter 25 Prompt 25.2, only once there's demonstrated inbound demand from multi-stylist salons, not built speculatively ahead of that demand.

6. **Longest-term — product/affiliate marketplace and training/course hosting.** Per Chapter 25 Prompts 25.4 and 25.5's own explicit caution: these are meaningfully different products from the platform's core identity and warrant a dedicated strategic reconsideration — including the live option of concluding "don't build this" — before any implementation, not just a later slot on the roadmap.

**Payment processing margin** (a small spread on deposit processing) is a natural, low-effort addition alongside the take-rate introduction in stage 3, rather than its own separate stage, since it uses the same Stripe integration already in place.

---

## 11. Success Metrics & KPIs

| KPI | Why it matters | Early-stage healthy signal |
|---|---|---|
| **Activation rate** (% of signed-up stylists reaching their first AI-handled booking) | Measures whether onboarding friction (Chapter 6) is actually low enough | A well-run onboarding funnel commonly sees well over half of signups activate; trend matters more than a specific number this early |
| **Weekly/Monthly Active Stylists** | Basic usage health | Should be rising steadily through Public Beta and Public Launch, not just flat signups |
| **Bookings per active stylist per month** | Direct measure of whether the tool is genuinely replacing manual booking work | Should approach or exceed what a stylist reports handling manually pre-platform |
| **AI Receptionist resolution rate** (Chapter 18's funnel data) | The core product promise — is the AI actually handling things without escalation | Reasonable to start lower (50-60%) during Public Beta and rise as Chapter 13's prompts mature; a rising trend matters more than the absolute number |
| **No-show rate, before vs. after adoption** | The specific pain point deposits and reminders (Chapters 9, 12) target | A meaningful reduction versus a stylist's self-reported pre-platform no-show rate is the clearest single proof of value |
| **MRR / ARR** | Core subscription-revenue health | Should show consistent month-over-month growth once Public Beta transitions to paid tiers |
| **Monthly logo churn** | Subscription retention | Early-stage SMB SaaS commonly treats anything above high single digits monthly as a signal to investigate onboarding/value-delivery, not just a number to accept |
| **LTV : CAC ratio** | Whether the business model is fundamentally sound | A commonly cited general benchmark is roughly 3:1 or better, though this varies meaningfully by channel and stage — treat it as a directional check, not a pass/fail gate |
| **CAC** | Cost efficiency of stylist acquisition | Should be low during the pilot/beta phase given the go-to-market's explicit reliance on direct, hands-on outreach rather than paid acquisition |
| **Conversation-to-booking conversion** (Chapter 18's funnel) | Where the AI Receptionist's flow is losing potential bookings | Watch stage-by-stage drop-off, not just the final number — a specific stage consistently leaking is more actionable than an aggregate |
| **Repeat-client rate** (Chapter 18, Prompt 18.1) | Stylist-level business health, and a proxy for platform trust | A rising trend for stylists using the platform's reminder/booking flow versus their own pre-platform baseline |
| **AI feature adoption** (once Chapter 14/15 ship) | Whether the moat features are actually used, not just built | Track opt-in and repeat-use rate specifically, not just "shipped" |
| **Marketplace health** (once Chapter 16 is live) | Supply/demand balance in the directory | Track searches-with-available-results rate, not just total listings — a directory full of fully-booked stylists is a weak marketplace even with many listings |

A general caution: benchmark figures above are broadly-cited industry rules of thumb, not guarantees or targets specific to this business — treat them as a starting frame for judgment, not a scorecard to optimize in isolation from what pilot stylists are actually saying.

---

## 12. Final Founder Guidance

**Prioritize customer feedback over the roadmap.** Everything in Sections 1-2 is a reasoned default sequence, not a commitment. If your first ten pilot stylists all report the same friction point that this library sequenced as V2, move it up — the roadmap exists to serve them, not the other way around.

**Know when to ship.** Chapter 13's escalation logic exists precisely so you can ship an AI Receptionist that isn't perfect — it just needs to know when to hand off. Waiting for the AI to handle every case before launching means never launching; waiting for it to safely defer when it can't is a much lower, achievable bar.

**Avoid feature creep.** Chapter 25 exists as a discipline device as much as a documentation one — every time a new feature idea arrives mid-build, the right question is "does this belong in the current milestone, or does it belong in Chapter 25's kind of deferred, trigger-conditioned list." Most ideas belong in the second bucket.

**Build sustainably.** As a solo founder, Section 4's Critical/Recommended/Optional split exists to protect you from burning limited time on Optional-tier work while Critical-tier work (security, payment correctness, escalation logic) is still thin. When in doubt, spend the next hour on something from the Critical tier.

**Use AI effectively during development.** This entire library is itself a demonstration of the practice it recommends: specify precisely, name what already exists, define success criteria explicitly, and review against them — not "ask for a feature and hope." The quality of what Claude Code or Cursor produces is bounded by the quality and specificity of what you ask for, more than by the tool's own ceiling.

**Scale the team thoughtfully, when the time comes.** The first hire is very likely someone who can extend Chapter 13's prompt/evaluation work (Section 9's M9-M10 territory) or handle the manual stylist onboarding/support load the pitch itself identified as the hardest part of this business — not, generally, a second generalist engineer, given how much of this system an AI-assisted solo founder can already cover directly.

**Prepare for investment deliberately, not reactively.** If growth (Section 11's MRR/retention trends) genuinely justifies raising, the artifacts this library already produces — the pitch document, this Engineering Playbook, and this Prompt Library itself — are unusually strong diligence materials for a technical investor, precisely because they show a considered, risk-aware build process rather than an ad hoc one. Don't manufacture urgency to raise before the metrics in Section 11 actually support the story.

---

This completes the Prompt Library and its operating manual. Together with the outline and all 25 chapters, this back matter closes the handbook requested at the outset: a complete, internally consistent reference for building, launching, and scaling this startup — from the first `pnpm install` through the first real paying stylist to whatever comes after.
