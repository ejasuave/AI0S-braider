# Chapter 24 — Mobile Optimisation

## Overview

This chapter ensures the responsive web application performs as a genuinely primary mobile experience rather than a desktop application that merely tolerates small screens — covering a responsive-layout audit across core flows, touch/interaction optimization, mobile-specific performance (load time, image optimization, building on Chapter 21's general performance work), and PWA/installability considerations.

## Why This Chapter Exists

Independent hair professionals overwhelmingly run their businesses from their phones — the pitch itself is built on the observation that stylists manage Instagram DMs and bookings on mobile, not desktop — which makes mobile experience quality a core product requirement, not a secondary concern to retrofit later. This chapter exists to audit and harden mobile experience specifically, after the core features (through Chapter 19) and general performance work (Chapter 21) are complete, so mobile-specific issues can be found against a feature-complete, already-reasonably-performant baseline rather than a moving target.

## Prompts in This Chapter

24.1 Responsive layout audit across core flows
24.2 Touch/interaction optimization
24.3 Mobile performance (load time, image optimization)
24.4 PWA/installability considerations

---

### Prompt 24.1 — Responsive Layout Audit Across Core Flows

**Category:** Mobile Optimisation — Foundation
**Objective:** Audit every core user-facing flow built across Chapters 5, 6, 11, 16, and 17 for correct, genuinely usable (not merely non-broken) rendering across common mobile viewport sizes.

**Context:** Requires the core frontend surfaces from Chapters 5, 6, 11, 16, and 17 to exist. This is the foundational, diagnostic prompt of the chapter.

**Prompt:**

```
Perform a responsive layout audit across every core user-facing flow in apps/web, testing against common mobile viewport sizes (e.g., a small phone at 375px width and a larger phone at 428px width, at minimum, per standard responsive testing practice) rather than assuming desktop layouts degrade gracefully.

Requirements:
- Audit the stylist onboarding flow (Chapter 6's profile/pricing/policy setup) specifically, since the pitch and Playbook are both explicit that onboarding friction directly threatens adoption, and a stylist completing this flow is very likely doing so from their phone
- Audit the embeddable chat widget (Chapter 11, Prompt 11.4) with particular care, since it renders on a stylist's public profile page which will very often be viewed by a client on mobile — confirm the widget doesn't overlap other page content, is easily dismissible/expandable with touch, and its message-composition area works correctly with mobile on-screen keyboards (a common failure mode is a fixed-position chat input being obscured by the keyboard)
- Audit the stylist dashboard (Chapter 17) for a genuinely usable mobile experience, not merely a non-broken one — specifically the calendar view (Prompt 17.2) and escalation inbox (Prompt 17.3), since a stylist reviewing an escalated conversation or checking today's schedule between clients is a realistic, common mobile use case this platform is explicitly built around
- Audit the public search/directory pages (Chapter 16) and a stylist's public profile page for correct mobile rendering, since client-side discovery is very plausibly a mobile-first behavior as well
- Fix any layout issue found (overlapping elements, horizontally scrolling content that shouldn't scroll, touch targets rendered too small to interact with reliably) and write visual-regression or component tests where practical to prevent future regression, documenting audit findings and fixes in a new docs/MOBILE_AUDIT.md
```

**Expected Output:** A completed responsive-layout audit across onboarding, the chat widget, the dashboard, and public discovery pages, with identified issues fixed and documented, plus regression tests where practical.

**Success Criteria:**

- The chat widget is confirmed, via manual or automated testing at mobile viewport sizes, to remain usable with an on-screen keyboard present, not obscured or broken
- The dashboard's calendar and escalation-inbox views are confirmed to be genuinely usable (not just non-broken) at common mobile viewport widths
- `docs/MOBILE_AUDIT.md` documents every flow audited, issues found, and fixes applied

**Dependencies:** Chapter 5, Chapter 6, Chapter 11 (Prompt 11.4), Chapter 16, Chapter 17

---

### Prompt 24.2 — Touch/Interaction Optimization

**Category:** Mobile Optimisation — Interaction Design
**Objective:** Go beyond layout correctness (Prompt 24.1) to optimize actual touch-interaction quality — tap target sizing, gesture support where appropriate, and avoiding interaction patterns that assume a mouse (hover-dependent UI, in particular).

**Context:** Requires Prompt 24.1 (layout must be correct before interaction can be meaningfully optimized) and touches the same set of core flows.

**Prompt:**

```
Perform a touch-interaction optimization pass across apps/web's core flows, building on Prompt 24.1's layout audit.

Requirements:
- Audit every interactive element (buttons, form inputs, calendar date/time selectors in Chapter 17's booking view, navigation items) against a minimum touch-target size (e.g., 44x44 points, a widely recognized accessibility and usability baseline for touch interfaces) and correct any found to be smaller, since small touch targets are a common source of mis-taps and frustration on mobile specifically
- Audit for any interaction pattern that depends on hover state to reveal necessary information or controls (a common desktop-first pattern that breaks entirely on touch devices, which have no hover equivalent) — specifically check Chapter 10's review-response UI, Chapter 17's dashboard action menus, and Chapter 16's search-result cards for any hover-dependent affordance, and convert these to tap-triggered or always-visible patterns
- Optimize the calendar/time-slot selection interface (Chapter 17, Prompt 17.2, and any client-facing slot-selection UI reachable through Chapter 11's widget) specifically for touch — this is one of the most interaction-dense parts of the entire platform and deserves particular care, given how central slot selection is to the core booking flow
- Ensure form inputs across the platform (Chapter 6's onboarding forms, in particular) use appropriate mobile input types (e.g., a numeric keyboard for price fields, a tel-type input for phone numbers) so the on-screen keyboard presented matches the expected input, rather than a generic text keyboard for every field
- Write component/interaction tests confirming touch-target sizing meets the documented minimum for a representative sample of the audited interactive elements, and manually verify (documenting the verification, since some of this is inherently a manual UX judgment) the hover-dependent-pattern fixes and calendar/slot-selection touch optimization
```

**Expected Output:** Touch-target sizing corrected to a documented minimum across interactive elements, hover-dependent patterns converted to tap-triggered/always-visible equivalents, an optimized calendar/slot-selection touch interface, and appropriate mobile input types across forms, with tests and documented manual verification.

**Success Criteria:**

- A representative sample of interactive elements is confirmed, via test, to meet the documented minimum touch-target size
- Every hover-dependent pattern identified in Chapter 10, 16, and 17's UI is confirmed converted to a touch-appropriate equivalent
- Price and phone-number input fields are confirmed to trigger the correct specialized mobile keyboard type

**Dependencies:** Prompt 24.1, Chapter 10, Chapter 16, Chapter 17

---

### Prompt 24.3 — Mobile Performance (Load Time, Image Optimization)

**Category:** Mobile Optimisation — Performance
**Objective:** Extend Chapter 21's general performance audit with mobile-specific concerns — particularly image optimization and load time under realistic mobile network conditions, not just desktop broadband.

**Context:** Requires Chapter 21 (Prompt 21.3's frontend bundle audit, which this prompt extends specifically for mobile network conditions) and Prompts 24.1-24.2 (a stable, corrected mobile UI to measure performance against).

**Prompt:**

```
Extend Chapter 21's Prompt 21.3 frontend performance audit with mobile-network-specific measurement and optimization.

Requirements:
- Re-measure the load-time/time-to-interactive metrics documented in Chapter 21's docs/PERFORMANCE_AUDIT.md specifically under throttled, realistic mobile network conditions (e.g., a simulated "Slow 4G" profile, not just unthrottled broadband), for the same key public-facing page types identified there (a stylist's public profile with embedded chat widget, search results, the widget in isolation) plus the stylist dashboard's mobile view
- Specifically optimize portfolio and search-result images (Chapter 6, Chapter 16) for mobile: confirm responsive image sizing serves an appropriately smaller image to a mobile viewport rather than downscaling a full desktop-sized image client-side, and confirm modern, efficient image formats are used where supported, falling back appropriately
- Audit the chat widget's (Chapter 11, Prompt 11.4) initial load specifically under throttled mobile conditions, since it's the first interactive element a mobile client encounters on a stylist's profile page and its load performance directly affects whether that client waits for it or bounces — apply any further code-splitting or lazy-loading optimization needed to get its initial interactive time within the budget established in Chapter 21
- Update the performance budgets in Chapter 21's docs/PERFORMANCE_AUDIT.md with mobile-network-specific targets alongside the existing broadband targets, since a single unified budget across both conditions would likely be either too lax for mobile or unrealistically strict for the broadband case
- Write a CI-integrated (or documented-as-manual-if-CI-integration-isn't-practical-yet) mobile-network-throttled performance check for the highest-priority public-facing pages, extending Chapter 21's existing bundle-size CI check
```

**Expected Output:** Mobile-network-throttled performance measurements for key page types, optimized responsive/efficient-format image delivery for portfolio and search-result images, further-optimized chat widget load performance under throttled conditions, updated dual (mobile + broadband) performance budgets, and an extended CI check.

**Success Criteria:**

- Mobile-network-throttled measurements are confirmed to exist alongside the original broadband measurements in `docs/PERFORMANCE_AUDIT.md`, with realistic, documented targets for each
- Portfolio and search-result images are confirmed, via network inspection during test, to serve appropriately sized images to a mobile viewport rather than a full-size desktop image
- The chat widget's interactive-readiness time under throttled mobile conditions is confirmed to meet its documented budget after this prompt's optimizations

**Dependencies:** Chapter 21 (Prompt 21.3), Prompt 24.1, Prompt 24.2

---

### Prompt 24.4 — PWA/Installability Considerations

**Category:** Mobile Optimisation — Installability
**Objective:** Evaluate and, where beneficial, implement Progressive Web App capabilities (installability, offline-tolerant basics, home-screen icon) for the stylist-facing dashboard specifically, given how frequently a stylist is likely to return to it throughout their workday.

**Context:** Requires Prompts 24.1-24.3 (a mobile-optimized, performant base to add PWA capability on top of). This is the chapter's final, most optional-in-scope prompt — the requirement is to evaluate and implement where genuinely beneficial, not to force full PWA/offline support regardless of actual value.

**Prompt:**

```
Evaluate and implement appropriate Progressive Web App capabilities for the stylist-facing dashboard (Chapter 17), given a stylist realistically returns to this dashboard many times throughout a working day from their phone.

Requirements:
- Implement a web app manifest and appropriate icons enabling "Add to Home Screen" installability for the stylist dashboard specifically (not necessarily the public-facing client/discovery pages, where installability is less relevant to a one-time or infrequent visitor), so a stylist can add a proper home-screen icon rather than relying on a bookmark or repeatedly navigating through a browser
- Evaluate, rather than assume, the value of offline support for this specific application: given the dashboard's core value (real-time booking/escalation visibility per Chapter 17, Prompt 17.5) fundamentally requires connectivity, full offline functionality is likely low-value and potentially misleading (a stylist viewing stale offline data during an outage could make a decision based on outdated information) — document this evaluation and its conclusion explicitly in a new docs/PWA_EVALUATION.md rather than defaulting to building offline support just because PWA tooling makes it possible
- If any offline capability is implemented despite the above evaluation, scope it narrowly and honestly (e.g., a clear "you're offline, showing last-known data as of [timestamp]" indicator, never presenting potentially-stale data as if it were current) rather than a full offline-first architecture
- Implement basic service-worker-based caching for the dashboard's static assets (not dynamic booking/conversation data, consistent with Chapter 21's caching-strategy principle that real-time data should never be served stale) to improve repeat-visit load performance, which is a lower-risk, clearly beneficial PWA capability distinct from the offline-data question above
- Write a verification test/checklist confirming the manifest and icons produce a correctly installable experience on at least one major mobile platform (iOS Safari and/or Android Chrome, whichever the team can practically verify), and document the offline-support evaluation and conclusion clearly enough that a future session doesn't need to re-litigate the same tradeoff from scratch
```

**Expected Output:** A web app manifest and icons enabling home-screen installability for the stylist dashboard, an explicit, documented evaluation of offline support concluding with a deliberate, narrow scope decision (rather than defaulting to full offline support), service-worker caching for static assets only, and installability verification.

**Success Criteria:**

- The stylist dashboard is confirmed, via manual verification on at least one major mobile platform, to be installable to the home screen with a correct icon and name
- `docs/PWA_EVALUATION.md` clearly documents the offline-support evaluation and its conclusion, providing a decision future sessions can reference rather than re-deciding
- Any implemented caching is confirmed, via code review, to apply only to static assets, never to real-time booking/conversation/availability data, consistent with Chapter 21's established caching principles

**Dependencies:** Prompts 24.1, 24.2, 24.3, Chapter 17, Chapter 21 (caching principles)

---

## Chapter 24 Summary

At the end of this chapter, the platform's mobile experience has been deliberately hardened rather than assumed to work by virtue of responsive CSS alone: layouts audited and fixed across every core flow, touch interactions optimized specifically (not just "not broken" but genuinely usable), performance measured and optimized under realistic mobile network conditions distinct from broadband, and installability added to the stylist dashboard with an honest, documented evaluation of offline support rather than a default assumption that more PWA features are automatically better.

**Prompt 24.4's evaluate-rather-than-assume approach to offline support is worth highlighting as a general principle for this chapter and beyond:** PWA tooling makes offline support technically easy to add, but for a platform whose core value is real-time booking and escalation visibility, stale offline data is a liability, not a convenience. This is a useful pattern to apply elsewhere in the codebase whenever a technically-available capability doesn't automatically translate into genuine user value.

---

Ready to proceed to Chapter 25 (Future Features) when you are.
