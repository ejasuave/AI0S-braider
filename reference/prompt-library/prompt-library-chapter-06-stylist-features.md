# Chapter 6 — Stylist Features

## Overview

This chapter implements everything a stylist configures about their own business: profile and bio, portfolio (manual upload and Instagram import), the structured service/pricing taxonomy that the AI Receptionist (Chapter 13) and Style Recognition AI (Chapter 14) will depend on, deposit and cancellation policy configuration, and working-hours/availability rules feeding the Booking Engine (Chapter 7). This is one of the highest-leverage chapters in the library: the data modeled here is read by nearly every later AI and booking feature, so getting the structured pricing taxonomy right matters more than it might first appear.

## Why This Chapter Exists

The Engineering Playbook is explicit that pricing must be structured data (style category, size/length tier, price, duration), not free text, because the AI Receptionist needs deterministic lookups rather than inference from prose. This chapter exists to build that structured foundation carefully, since a poorly modeled pricing taxonomy here becomes a source of AI hallucination and incorrect quotes in Chapter 13 — a problem that is far more expensive to fix retroactively than to model correctly now.

## Prompts in This Chapter

6.1 Stylist profile creation and editing
6.2 Portfolio upload and management (manual)
6.3 Instagram import integration
6.4 Service/pricing list management (structured taxonomy)
6.5 Deposit and cancellation policy configuration
6.6 Working hours and availability rules

---

### Prompt 6.1 — Stylist Profile Creation and Editing

**Category:** Stylist Features — Foundation
**Objective:** Implement the core stylist business profile, connecting to the `businesses` table already established in Chapter 4, and building the guided onboarding wizard's backend support (persisting each step independently, per the Playbook's requirement that abandoned onboarding not lose data).

**Context:** Requires Chapter 4 (the `businesses` table and role guards already exist) and Chapter 3 (a `stylist_owner` user must exist to own a business). This is the first prompt to create real content in the `businesses` table beyond its bare existence.

**Prompt:**

```
Implement stylist business profile creation and editing in a new src/modules/stylist-profile/ module (update ARCHITECTURE.md: owns bio, portfolio, pricing, policies, availability rules; does not own booking/calendar computation, which remains the Booking Engine's domain per the existing service boundary document).

Requirements:
- Extend the businesses table (from Chapter 4) with additional columns: bio (text, nullable), location (geography point type, nullable — for future proximity search in Chapter 16), service_area_radius_km (numeric, nullable — for home-visit stylists), onboarding_status (enum: in_progress, complete, default in_progress)
- Implement POST /api/v1/businesses (guarded by requireRole('stylist_owner')) to create the initial business record immediately after stylist signup, if one does not already exist for that user — this is the first time a businesses row is actually created, referenced as a forward dependency from Chapter 4
- Implement GET /api/v1/businesses/me and PATCH /api/v1/businesses/me, guarded by requireBusinessPermission appropriate to profile editing (define and use a can_manage_profile permission flag, extending the permissions taxonomy from Chapter 4's business_staff schema)
- Each onboarding step (bio, location, service area) must be independently saveable via partial PATCH requests — do not require the entire profile to be submitted at once, since the Playbook explicitly calls for incremental, resumable onboarding
- Implement PATCH /api/v1/businesses/me/onboarding-status to explicitly mark onboarding_status as complete once the stylist has finished all required steps (this endpoint's business-logic gate — i.e., which steps must be done first — should check that at least one service_offering exists (Prompt 6.4) and working hours are set (Prompt 6.6) before allowing completion; if those chapters haven't landed yet in this specific build order, implement this check against a clearly marked TODO and a temporary always-true stub)
- Write integration tests confirming: partial updates persist without requiring other fields, a business cannot be edited by a user who is neither the owner nor a staff member with can_manage_profile, and the onboarding-completion gate behaves as described
```

**Expected Output:** Extended `businesses` schema, working create/get/update endpoints supporting partial/incremental updates, an onboarding-completion endpoint with its gating logic (or a documented stub), and passing tests.

**Success Criteria:**

- A stylist can update just their `bio` without needing to resend `location` or any other field
- A staff member without `can_manage_profile` is rejected from editing the business profile, verified by test
- Onboarding cannot be marked complete without at least the minimum required steps (or the explicit TODO stub is clearly marked if built out of order)

**Dependencies:** Chapter 3, Chapter 4

---

### Prompt 6.2 — Portfolio Upload and Management (Manual)

**Category:** Stylist Features — Portfolio
**Objective:** Let a stylist manually upload and organize portfolio images, as the fallback path for stylists without an eligible Instagram account, and as the primary path until Prompt 6.3's import is built.

**Context:** Requires Prompt 6.1. Requires a file-storage decision (e.g., S3 or equivalent object storage) which this prompt should establish if not already set up elsewhere in the project — flag this as a shared infrastructure concern if other chapters (e.g., Chapter 14's image uploads) will reuse it.

**Prompt:**

```
Implement manual portfolio image upload and management in src/modules/stylist-profile/.

Requirements:
- Add a portfolio_items table: id, business_id (FK), image_url (text), source (enum: manual, instagram), display_order (integer), created_at
- Set up object storage integration (e.g., S3-compatible storage) as a shared utility in src/shared/storage/, generating pre-signed upload URLs so images are uploaded directly from the client to storage rather than proxied through the API server — document this pattern clearly, since Chapter 14 (Style Recognition AI) will reuse this exact utility for client-submitted inspiration photos
- Implement POST /api/v1/businesses/me/portfolio/upload-url, guarded by requireBusinessPermission('can_manage_profile'), returning a pre-signed upload URL and the resulting final image_url the client should register afterward
- Implement POST /api/v1/businesses/me/portfolio to register a successfully uploaded image_url as a new portfolio_items row with source: manual
- Implement PATCH /api/v1/businesses/me/portfolio/reorder accepting an ordered list of portfolio item IDs and updating display_order accordingly
- Implement DELETE /api/v1/businesses/me/portfolio/:itemId, removing the record (and optionally the underlying stored object, following whatever data-retention convention the team prefers — document the choice)
- Enforce a reasonable per-business portfolio item limit (e.g., 50 images) to prevent unbounded storage growth, returning a clear validation error when exceeded
- Write integration tests covering: successful upload-url generation and registration flow, reorder correctness, deletion, and enforcement of the item limit
```

**Expected Output:** A `portfolio_items` table, a shared pre-signed-upload storage utility (explicitly reusable by Chapter 14), working upload/register/reorder/delete endpoints, and passing tests including the item-limit enforcement.

**Success Criteria:**

- A pre-signed upload URL successfully allows a direct-to-storage upload in a test/integration environment
- Reordering produces the correct `display_order` values, verified by re-fetching the list afterward
- Attempting to add a 51st portfolio item (given a 50-item limit) is rejected with a clear validation error
- The storage utility module is confirmed reusable (not portfolio-specific in its implementation) for Chapter 14's future use

**Dependencies:** Prompt 6.1

---

### Prompt 6.3 — Instagram Import Integration

**Category:** Stylist Features — Portfolio
**Objective:** Let a stylist connect their Instagram Business/Creator account and import existing photos directly into their portfolio, reducing onboarding friction, with a graceful fallback to Prompt 6.2's manual upload when the account is ineligible.

**Context:** Requires Prompts 6.1 and 6.2 (portfolio_items table and storage utility already exist). Requires an Instagram/Meta developer app to be registered outside of code (a manual, one-time external setup step — document this clearly as a prerequisite rather than something the AI assistant can do itself).

**Prompt:**

```
Implement Instagram import for stylist portfolios in src/modules/stylist-profile/.

Requirements:
- Note as a prerequisite in the prompt's own documentation: this requires a registered Meta developer app with Instagram Basic Display or Instagram Graph API access already configured outside of this codebase — do not attempt to provision Meta app credentials programmatically; assume the relevant App ID/Secret are already present via the environment variable system from Chapter 1
- Implement the OAuth-style connection flow for a stylist to authorize Instagram access, storing the resulting access token encrypted at rest, reusing the encryption utility established in Chapter 3's OAuth prompt (src/shared/security/) rather than creating a new one
- Implement POST /api/v1/businesses/me/instagram/import, guarded by requireBusinessPermission('can_manage_profile'), fetching recent media from the connected Instagram account and creating portfolio_items rows with source: instagram for each imported image, respecting the same per-business item limit enforced in Prompt 6.2
- Detect and handle the case of a private or non-Business/Creator Instagram account: the API call will fail with a specific error from Meta's API — catch this and return a clear, specific error code (e.g., INSTAGRAM_ACCOUNT_INELIGIBLE) rather than a generic failure, and ensure the frontend messaging (to be built in later UI-focused prompts, not this backend prompt) can direct the stylist to Prompt 6.2's manual upload as a fallback
- Handle Instagram access token expiry/refresh according to Meta's documented token lifecycle, storing a token_expires_at value and refreshing proactively via a background job (using the job infrastructure from Chapter 2) rather than only reacting to failed API calls
- Write integration tests using a mocked Instagram API client covering: successful import respecting the item limit, the ineligible-account error path, and token refresh logic
```

**Expected Output:** A working Instagram connection and import flow, encrypted token storage reusing existing infrastructure, specific error handling for ineligible accounts, a background token-refresh job, and passing tests against a mocked Instagram API client.

**Success Criteria:**

- A successful import creates `portfolio_items` rows tagged `source: instagram`, respecting the existing per-business limit from Prompt 6.2
- An ineligible (private/personal) account produces the specific `INSTAGRAM_ACCOUNT_INELIGIBLE` error code rather than a generic failure
- Instagram access tokens are confirmed encrypted at rest via a test inspecting the raw stored value
- A background job correctly refreshes a token nearing expiry, verified by a test that simulates an approaching `token_expires_at`

**Dependencies:** Prompts 6.1, 6.2, Chapter 3 (encryption utility), Chapter 2 (background jobs)

---

### Prompt 6.4 — Service/Pricing List Management (Structured Taxonomy)

**Category:** Stylist Features — Pricing (Critical Path)
**Objective:** Implement the structured service/pricing data model — the single most important data structure for the AI Receptionist (Chapter 13) and Style Recognition AI (Chapter 14) to function correctly — including a seeded taxonomy of common style categories to reduce manual data entry.

**Context:** Requires Prompt 6.1. This prompt should be treated with particular care: its schema design is referenced directly by two later AI-heavy chapters, and a design mistake here propagates widely. Review this prompt's output more carefully than most others in the library.

**Prompt:**

```
Implement the structured service/pricing taxonomy in src/modules/stylist-profile/. This schema will be directly consumed by the AI Receptionist (a later chapter) for deterministic price/duration lookup, so field structure matters more here than in most other prompts — do not use free-text pricing.

Requirements:
- Add a style_categories reference table (seeded, not stylist-editable): id, name (e.g., "Knotless Braids", "Cornrows", "Box Braids", "Boho Braids", "Passion Twists" — seed with a reasonably comprehensive real-world list of common braiding/styling categories), is_custom (boolean, default false)
- Add a service_offerings table: id, business_id (FK), style_category_id (FK to style_categories, nullable if is_custom style used instead), custom_style_name (text, nullable — used only when a stylist's style isn't in the seeded list, working together with a corresponding is_custom flag on style_categories or a dedicated custom-style creation path), size_tier (text, nullable, e.g., "Small", "Medium", "Large"), length_tier (text, nullable, e.g., "Shoulder-length", "Waist-length"), base_price (numeric), estimated_duration_minutes (integer), hair_included (boolean), active (boolean, default true)
- Implement GET /api/v1/style-categories (public, unauthenticated — this is reference data used by both stylist-facing pricing setup and later client-facing conversation flows)
- Implement POST /api/v1/businesses/me/services, guarded by requireBusinessPermission('can_manage_pricing') (a new permission flag, extending Chapter 4's taxonomy), allowing a stylist to add a service offering either against a seeded style_category_id or as a custom style
- Implement PATCH and DELETE (soft-delete via active: false, not hard delete, since past bookings may reference this offering) equivalents, similarly guarded
- Implement GET /api/v1/businesses/me/services and a public GET /api/v1/businesses/:businessId/services for the stylist's own management view and eventual public/AI-facing consumption respectively
- Explicitly document, in a code comment and in docs/API_CONVENTIONS.md, that custom (non-seeded) style offerings should be treated as lower-confidence by any future AI consumer (this is a forward note for Chapter 13, not something this prompt needs to implement logic for)
- Write integration tests covering: creating an offering against a seeded category, creating a custom offering, soft-deletion preserving historical referenceability, and permission enforcement
```

**Expected Output:** Seeded `style_categories` reference data, a `service_offerings` table supporting both seeded and custom styles, full CRUD (soft-delete) endpoints appropriately guarded, a public reference-data endpoint, and passing tests.

**Success Criteria:**

- The seeded `style_categories` list is comprehensive enough to cover the majority of common braiding/styling requests without needing a custom entry for typical cases
- A soft-deleted (`active: false`) service offering remains queryable by ID (for historical bookings that reference it) but does not appear in default active-offerings listings
- A staff member without `can_manage_pricing` cannot create, update, or delete service offerings, verified by test
- Documentation clearly flags custom styles as lower-confidence for future AI consumption

**Dependencies:** Prompt 6.1

---

### Prompt 6.5 — Deposit and Cancellation Policy Configuration

**Category:** Stylist Features — Policy
**Objective:** Let a stylist configure their deposit requirements and cancellation/no-show policy, which the Booking Engine (Chapter 7) and Payments module (Chapter 9) will read as the authoritative policy source.

**Context:** Requires Prompt 6.1. This prompt defines a contract that Chapters 7 and 9 will consume — build the schema thoughtfully since it is referenced by two downstream chapters' business logic.

**Prompt:**

```
Implement deposit and cancellation policy configuration in src/modules/stylist-profile/.

Requirements:
- Extend the businesses table (or add a separate business_policies table, preferred for clarity — id, business_id FK unique, deposit_type (enum: flat, percentage), deposit_value (numeric — a flat currency amount or a percentage depending on deposit_type), cancellation_window_hours (integer — how many hours before an appointment a client may cancel for a full refund), no_show_fee_type (enum: forfeit_deposit, flat_fee, no_fee), no_show_fee_value (numeric, nullable, used only if no_show_fee_type is flat_fee)
- Implement GET /api/v1/businesses/me/policy and PATCH /api/v1/businesses/me/policy, guarded by requireBusinessPermission('can_manage_pricing') (reuse this permission flag rather than introducing a new one, since policy and pricing are closely related business decisions typically made by the same person)
- Provide sensible pre-filled defaults (e.g., 20% deposit, 24-hour cancellation window, forfeit_deposit on no-show) that a stylist can accept with a single confirming action during onboarding, per the Playbook's onboarding-friction requirements
- Validate that percentage-based deposit_value is between 1 and 100, and flat deposit_value is a positive amount, via Zod schema
- Expose a public (or internal-service-to-service) GET /api/v1/businesses/:businessId/policy endpoint for the Booking Engine (Chapter 7) and Payments (Chapter 9) modules to call when calculating a required deposit or evaluating a cancellation, following the cross-module access rule of calling through this module's service layer rather than another module querying the policy table directly
- Write integration tests covering: default policy application, valid updates, rejection of an out-of-range percentage value, and correct cross-module retrieval via the service-layer function
```

**Expected Output:** A `business_policies` table (or equivalent extension), get/update endpoints with sensible defaults and validation, and a service-layer function for other modules to consume, with passing tests.

**Success Criteria:**

- A newly onboarded stylist has a sensible default policy in place without any explicit configuration action, verified by test
- Setting `deposit_value` to 150 with `deposit_type: percentage` is rejected as invalid
- The cross-module service function returns the correct policy data in a form Chapter 7/9 prompts can consume directly, without those chapters needing to know the underlying table structure

**Dependencies:** Prompt 6.1

---

### Prompt 6.6 — Working Hours and Availability Rules

**Category:** Stylist Features — Scheduling Foundation
**Objective:** Let a stylist define their working hours and recurring availability rules, which the Booking Engine's availability computation (Chapter 8) will consume as its base input before layering on holds, confirmed bookings, and external calendar sync.

**Context:** Requires Prompt 6.1. This prompt defines the input data; it does not compute actual available slots (that is Chapter 8's responsibility) — keep this distinction explicit in the implementation.

**Prompt:**

```
Implement working-hours and availability-rule configuration in src/modules/stylist-profile/. This prompt defines the stylist's base schedule rules only — it does not compute actual bookable time slots, which is the Booking Engine/Calendar module's responsibility in a later chapter.

Requirements:
- Add a working_hours table: id, business_id (FK), day_of_week (integer 0-6), start_time (time), end_time (time), is_active (boolean, default true) — one or more rows per day of week allowed, to support split shifts (e.g., a stylist working 9am-1pm and then 3pm-7pm on the same day)
- Add a schedule_exceptions table for one-off overrides: id, business_id (FK), date (date), is_closed (boolean — true for a full day off), override_start_time (time, nullable), override_end_time (time, nullable) — used for holidays, vacations, or one-off extended/reduced hours
- Implement GET /api/v1/businesses/me/working-hours and PUT (full replace, since a stylist typically sets their whole week at once) /api/v1/businesses/me/working-hours, guarded by requireBusinessPermission('can_manage_bookings') (a permission flag from Chapter 4's taxonomy, distinct from can_manage_pricing since a stylist might delegate schedule management separately from pricing authority)
- Implement POST, PATCH, and DELETE for individual schedule_exceptions entries, similarly guarded
- Validate that start_time is before end_time for any given row, and that split-shift ranges for the same day_of_week do not overlap each other, via Zod/application-level validation
- Expose a service-layer function (e.g., getBaseAvailabilityRules(businessId, dateRange)) that Chapter 8's calendar/availability computation will call, returning the combined effect of working_hours and any schedule_exceptions within the given range, so Chapter 8 does not need to re-derive this merge logic itself
- Write integration tests covering: setting a full week including a split shift, rejecting overlapping shifts on the same day, applying a schedule exception that closes a specific date, and the combined service-layer function returning correct merged availability for a test date range
```

**Expected Output:** `working_hours` and `schedule_exceptions` tables, guarded CRUD endpoints, validation preventing invalid/overlapping time ranges, a combined service-layer function ready for Chapter 8 to consume, and passing tests.

**Success Criteria:**

- A split-shift working-hours configuration (two non-overlapping ranges on the same day) is accepted; an overlapping pair is rejected
- A `schedule_exceptions` entry marking a specific date as closed correctly overrides that date's regular working hours when queried through the combined service function
- The combined service-layer function's output is structured clearly enough that Chapter 8 can consume it without needing to understand the underlying two-table split

**Dependencies:** Prompt 6.1

---

## Chapter 6 Summary

At the end of this chapter, a stylist can fully configure their business: profile, portfolio (manual or Instagram-imported), a structured service/pricing taxonomy, deposit/cancellation policy, and working hours. Four service-layer functions or data contracts from this chapter are explicitly designed for downstream consumption: the pricing taxonomy (Prompt 6.4) by Chapter 13's AI Receptionist and Chapter 14's Style Recognition AI, the policy data (Prompt 6.5) by Chapters 7 and 9, and the combined availability rules (Prompt 6.6) by Chapter 8.

**Prompt 6.4 (structured pricing taxonomy) is the highest-leverage prompt in this chapter** — its schema quality directly determines how reliably the AI Receptionist can quote prices without hallucinating. If revisiting or refactoring anything in this chapter later, prioritize getting that one right over the others.

---

Ready to proceed to Chapter 7 (Booking Engine) when you are.
