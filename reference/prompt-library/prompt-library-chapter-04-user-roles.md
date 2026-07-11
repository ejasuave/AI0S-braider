# Chapter 4 — User Roles & Permissions

## Overview

This chapter builds the authorization layer on top of the authentication system from Chapter 3. Where Chapter 3 answers "who is this user," this chapter answers "what is this user allowed to do." It implements role-based route guards, multi-staff permission scoping for stylist businesses (anticipated in the Engineering Playbook as a future-improvement item now being pulled forward as a foundational concern), and admin impersonation with audit logging. Every feature chapter from Chapter 5 onward assumes these guards exist and will simply reference them rather than re-implementing access control per-feature.

## Why This Chapter Exists

Authorization bugs are among the most damaging category of bug in a multi-sided platform — a stylist seeing another stylist's bookings, or a staff account seeing the owner's payout details, is a trust-destroying failure. Building a single, consistent permission-checking layer now, before any feature with sensitive data exists, means every later chapter's prompts can simply say "apply the standard role guard for stylist_owner" instead of re-deriving access logic feature by feature — which is exactly the kind of inconsistency this library exists to prevent.

## Prompts in This Chapter

4.1 Implement role schema (client, stylist_owner, stylist_staff, admin)
4.2 Implement role-based route/API guards
4.3 Implement stylist multi-staff permission scoping
4.4 Implement admin impersonation/support access (with audit logging)

---

### Prompt 4.1 — Implement Role Schema

**Category:** User Roles — Foundation
**Objective:** Formalize the role model beyond the single `role` enum column already on `users` (Chapter 3), introducing the data structures needed for multi-staff businesses and fine-grained permissions, without yet wiring enforcement into any route (that is Prompt 4.2).

**Context:** Requires Chapter 3 complete (the `users` table and its `role` column already exist). This prompt is schema and data-modeling only.

**Prompt:**

```
Extend the role model established in Chapter 3 to support multi-staff stylist businesses and fine-grained permissions, in src/modules/roles/ (a new module, since this logic is cross-cutting and not owned by auth itself per ARCHITECTURE.md's ownership rules — update ARCHITECTURE.md to add this module and its ownership scope).

Requirements:
- The existing users.role column (stylist_owner, stylist_staff, client, admin) remains the primary/coarse role
- Add a businesses table representing a stylist's business entity, separate from the user who owns it: id, owner_user_id (FK to users, must be a stylist_owner), business_name, created_at — this anticipates a business having multiple staff accounts (Chapter 6/17 will build on this) rather than conflating "user" and "business" as the same concept
- Add a business_staff table: id, business_id (FK), user_id (FK, must be role stylist_staff), permissions (jsonb — a set of granular permission flags such as can_manage_bookings, can_manage_pricing, can_view_payouts, can_manage_staff), invited_at, accepted_at (nullable — staff must accept an invitation before permissions are active), removed_at (nullable)
- A stylist_owner user implicitly has all permissions over their own business_id and does not need a business_staff row for themselves
- Update the shared Zod types in packages/shared-types to reflect the businesses and business_staff shapes, following the established shared-type convention from Chapter 2
- Write unit tests for the data model relationships (e.g., a staff member with removed_at set should be treated as having no active permissions by any helper function that reads this table) but do not yet implement route-level enforcement — that is the next prompt
```

**Expected Output:** `businesses` and `business_staff` tables/migrations, updated shared types, an updated `ARCHITECTURE.md` entry for the new roles module, and unit tests for the relationship/permission-flag logic.

**Success Criteria:**

- A `stylist_owner` can have exactly one associated `businesses` row created for them (enforce or document how businesses are created — likely as part of Chapter 6 onboarding, referenced here as a forward dependency)
- A helper function correctly reports "no active permissions" for a `business_staff` row with `removed_at` set or `accepted_at` still null
- `ARCHITECTURE.md` is updated to list the new `roles` module and its ownership boundary (owns: role/permission data structures and evaluation logic; does not own: business profile content, which remains Stylist Profile's domain per Chapter 6)

**Dependencies:** Chapter 3

---

### Prompt 4.2 — Implement Role-Based Route/API Guards

**Category:** User Roles — Enforcement
**Objective:** Build the middleware/guard layer that every protected route in every future chapter will use to declare and enforce its required role or permission, following the standard middleware chain established in Chapter 2.

**Context:** Requires Prompt 4.1 (role/permission data model) and Chapter 2's documented middleware chain (auth, then role/permission check, then validation).

**Prompt:**

```
Implement reusable role-based and permission-based route guards in src/modules/roles/, to be inserted into the middleware chain (established in docs/API_CONVENTIONS.md, Chapter 2) immediately after authentication and before input validation.

Requirements:
- Implement a requireRole(...roles) middleware factory that checks the authenticated user's coarse role (from their JWT claims established in Chapter 3) against an allowed list, returning the standard FORBIDDEN error envelope if the check fails
- Implement a requireBusinessPermission(permissionFlag) middleware factory that, for a route operating on a specific business_id (extracted from the route params or resolved from the authenticated user), checks: if the user is the business's stylist_owner, always allow; if the user is stylist_staff, look up their business_staff row and check the specific permissionFlag is true and the row is active (accepted_at set, removed_at null) — otherwise return FORBIDDEN
- Both guards must produce a structured audit-relevant log entry (using the Chapter 1 logging convention) on every FORBIDDEN rejection, including user_id, attempted resource, and required permission, since repeated FORBIDDEN entries from the same user are a signal worth monitoring
- Update the /api/v1/ping example endpoint (or create a new dummy protected endpoint) to demonstrate both guards working correctly, purely as a verification example — no real feature route needs to exist yet
- Write integration tests covering: a client attempting a stylist-only route (rejected), a stylist_staff with the correct permission flag succeeding, a stylist_staff without the flag being rejected, a removed staff member being rejected even if their permissions object still shows the flag as true (proving removed_at is checked, not just the flag), and a stylist_owner succeeding on any permission check for their own business without needing a business_staff row
- Document the two guard functions and their usage pattern in docs/API_CONVENTIONS.md, since every feature route built from Chapter 5 onward will reference this documentation rather than re-explaining the guards
```

**Expected Output:** `requireRole` and `requireBusinessPermission` middleware factories, structured logging on rejection, a working demonstration route, passing integration tests for all five listed scenarios, and updated documentation.

**Success Criteria:**

- A request from a `client`-role user to a route guarded by `requireRole('stylist_owner', 'stylist_staff')` is rejected with `FORBIDDEN`
- A `stylist_staff` user whose `business_staff` row has `removed_at` set is rejected even though their `permissions` jsonb still contains the relevant flag as true — proving the removal check is enforced, not just the flag
- A `stylist_owner` succeeds on a permission-guarded route for their own business without any `business_staff` row existing
- Every rejection produces a structured log entry containing the attempted resource and required permission

**Dependencies:** Prompt 4.1, Chapter 2 (middleware chain), Chapter 3 (JWT claims)

---

### Prompt 4.3 — Implement Stylist Multi-Staff Permission Scoping

**Category:** User Roles — Multi-Staff Businesses
**Objective:** Build the API surface that lets a stylist_owner invite, configure, and remove staff members with specific permission flags, using the guards from Prompt 4.2 to protect these very endpoints.

**Context:** Requires Prompts 4.1 and 4.2. This is the first feature-facing (not purely infrastructural) prompt in the chapter — it produces endpoints a real stylist_owner will use.

**Prompt:**

```
Implement the staff invitation and permission-management API in src/modules/roles/, protected by the guards built in Prompt 4.2.

Requirements:
- Implement POST /api/v1/businesses/:businessId/staff/invite, guarded by requireBusinessPermission('can_manage_staff') (and always allowed for the stylist_owner per Prompt 4.2's rule), accepting a phone_number or email and an initial permissions object, creating a business_staff row with accepted_at null, and sending an invitation notification (reuse the SmsProvider/EmailProvider abstractions from Chapter 3's OTP and password-reset prompts — do not create new provider integrations)
- Implement POST /api/v1/staff/invitations/:invitationId/accept, callable by the invited user once authenticated (they may need to sign up first via the existing Chapter 3 flows if they don't yet have an account), setting accepted_at
- Implement PATCH /api/v1/businesses/:businessId/staff/:staffId, guarded the same way, allowing the owner to update a staff member's permissions object
- Implement DELETE /api/v1/businesses/:businessId/staff/:staffId, guarded the same way, setting removed_at rather than hard-deleting the row (preserve history for audit purposes)
- Implement GET /api/v1/businesses/:businessId/staff, guarded to allow the owner or any staff member with can_manage_staff to list current staff and their permissions
- Validate all inputs with Zod schemas per Chapter 2's conventions, including validating that only known permission flag keys can be set (reject unknown flags rather than silently storing them)
- Write integration tests covering the full lifecycle: invite → accept → permission update → removal → confirming a removed staff member can no longer pass requireBusinessPermission checks (this should already be true from Prompt 4.2's logic, but test it end-to-end through these new routes as a regression safeguard)
```

**Expected Output:** Working invite/accept/update/remove/list endpoints for staff management, reusing existing notification-provider abstractions, with full Zod validation and integration test coverage of the staff lifecycle.

**Success Criteria:**

- A stylist_owner can invite a staff member, who can accept and immediately be subject to the correct permission scoping from Prompt 4.2
- Setting an unknown/invalid permission flag key is rejected with a `VALIDATION_ERROR`
- After a `DELETE` staff removal, a subsequent attempt by that staff member to access a permission-guarded route fails, verified end to end
- A staff member without `can_manage_staff` cannot access any of these endpoints for their own business, even to view the staff list

**Dependencies:** Prompts 4.1, 4.2, Chapter 3 (notification provider abstractions)

---

### Prompt 4.4 — Implement Admin Impersonation/Support Access

**Category:** User Roles — Admin Tooling
**Objective:** Build a tightly-audited impersonation capability allowing platform admins to view the platform as a specific stylist or client for support purposes, without ever being able to silently act as that user without a clear, permanent audit trail.

**Context:** Requires Prompts 4.1 and 4.2 (role model and guards) and Chapter 3's `admin` role already existing as an enum value. This prompt anticipates Chapter 19 (Admin Panel), which will build a UI on top of this backend capability — keep the API clean and self-contained so Chapter 19 only needs to build UI, not additional backend logic.

**Prompt:**

```
Implement admin impersonation with mandatory audit logging in src/modules/roles/, guarded exclusively by requireRole('admin').

Requirements:
- Add an impersonation_sessions table: id, admin_user_id (FK), target_user_id (FK), reason (text, required — an admin must state why they are impersonating), started_at, ended_at (nullable), created_from_ip (text)
- Implement POST /api/v1/admin/impersonate/:targetUserId, guarded by requireRole('admin'), requiring a reason in the request body, creating an impersonation_sessions record, and issuing a special, clearly-scoped access token that (a) contains both the admin's user_id and the target's user_id as distinct claims, never conflating them, (b) is short-lived (5 minutes, shorter than a normal session, requiring re-issuance for longer support sessions rather than a long-lived impersonation credential), and (c) is rejected by any endpoint that specifically requires a non-impersonated session (e.g., changing the target user's password or payout details must never be possible via an impersonation token — enforce this via a separate middleware check, isImpersonationToken, that explicitly blocks sensitive routes)
- Implement POST /api/v1/admin/impersonate/end to explicitly end an impersonation session, setting ended_at
- Every request made using an impersonation token must produce a structured log entry distinct from normal request logs, clearly tagged as an impersonated action, including the admin_user_id, target_user_id, and the specific route accessed — this is a hard requirement, not an optional enhancement, since impersonation without a complete audit trail is a significant trust and security liability
- Explicitly block impersonation tokens from being used on: password/OAuth changes, phone number changes, payout/bank detail changes, and account deletion — maintain this as an explicit denylist of route patterns checked by the isImpersonationToken middleware, and document the list in docs/SECURITY.md
- Write integration tests covering: successful impersonation session creation and token issuance, a blocked action (e.g., attempting to change the target's payout details while impersonating) being correctly rejected, and confirming every impersonated request produces the distinct audit log entry
```

**Expected Output:** An `impersonation_sessions` table, working start/end impersonation endpoints restricted to admins, a distinctly-scoped and short-lived impersonation token format, a denylist middleware blocking sensitive actions during impersonation, mandatory distinct audit logging, and passing integration tests for all listed scenarios.

**Success Criteria:**

- Only users with `admin` role can successfully call the impersonation-start endpoint; all others receive `FORBIDDEN`
- An impersonation token is confirmed, via test, to be rejected on at least one sensitive route from the denylist (e.g., a payout-details-change endpoint stubbed for this test if it doesn't exist yet, or deferred to be re-verified once Chapter 9 builds real payout endpoints)
- Every action taken during an impersonation session produces a log entry distinguishable from normal-session activity, containing both the admin and target user IDs
- `docs/SECURITY.md` documents the full denylist and the rationale for each blocked route category

**Dependencies:** Prompts 4.1, 4.2, Chapter 3 (admin role)

---

## Chapter 4 Summary

At the end of this chapter, the platform has a complete authorization layer: coarse role checks, fine-grained per-business permission scoping for multi-staff stylist accounts, and a carefully audited admin impersonation capability with an explicit denylist protecting the most sensitive actions. Every feature chapter from Chapter 5 onward should guard its routes using `requireRole` and `requireBusinessPermission` from Prompt 4.2 rather than writing new authorization logic, and any admin-facing feature in Chapter 19 should build on the impersonation and audit foundation from Prompt 4.4 rather than re-deriving it.

**A note on sequencing:** Prompt 4.4's denylist references payout and profile-change routes that do not exist until Chapters 6 and 9 are built. When those chapters are completed, revisit `docs/SECURITY.md`'s denylist and confirm the newly created sensitive routes have been explicitly added to it — this is exactly the kind of cross-chapter follow-up this library's dependency map (see Back Matter) exists to surface.

---

Ready to proceed to Chapter 5 (Customer Features) when you are.
