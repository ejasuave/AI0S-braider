# Chapter 3 — Authentication

## Overview

This chapter builds the first real feature schema and business logic in the project: the identity system every other feature depends on. It implements the `users` and `sessions` model from the Engineering Playbook's Identity chapter — password auth, phone-based OTP verification (needed because clients should be able to book without a full account, per the Playbook), OAuth login, rotating refresh tokens, account recovery, and rate limiting on auth endpoints. Every later chapter that requires "a logged-in stylist" or "a verified client" depends on this chapter being complete.

## Why This Chapter Exists

Authentication is the single feature every other feature transitively depends on — a booking belongs to a client, a stylist profile belongs to a stylist, a dashboard requires a logged-in session. Building it first, correctly, with proper token rotation and rate limiting, avoids a common and costly mistake: retrofitting security-sensitive auth logic after a dozen features already assume a looser, less-tested identity layer.

## Prompts in This Chapter

3.1 Implement core user schema and password auth
3.2 Implement phone-based OTP verification
3.3 Implement OAuth (Google/Apple) login
3.4 Implement session/refresh token handling with rotation
3.5 Implement account recovery flows
3.6 Implement rate limiting on auth endpoints

---

### Prompt 3.1 — Implement Core User Schema and Password Auth

**Category:** Authentication — Foundation
**Objective:** Create the `users` table and the first working authentication method (email/password) for stylist accounts, following the Engineering Playbook's Identity chapter schema and the architectural conventions established in Chapters 1-2.

**Context:** Requires Chapter 1 (database/ORM setup, module conventions) and Chapter 2 (API conventions, shared types). This is the first prompt in the project to create real, permanent application schema.

**Prompt:**

```
Implement the core user schema and password-based authentication, following the module conventions in CONTRIBUTING.md and the API conventions in docs/API_CONVENTIONS.md. Place this feature in src/modules/auth/ in apps/api.

Requirements:
- Add a users table via a Prisma migration with columns: id (uuid, PK), role (enum: stylist_owner, stylist_staff, client, admin), phone_number (text, unique, indexed, E.164 format), email (text, nullable — required for stylists, optional for clients, enforce this at the application layer, not a DB constraint, since roles differ), password_hash (text, nullable — null if OAuth-only, populated in the next prompt), phone_verified_at (timestamptz, nullable), created_at (timestamptz, default now), deactivated_at (timestamptz, nullable, for soft delete)
- Define the corresponding shared Zod schema in packages/shared-types for the public-facing User shape (never including password_hash), and a separate internal schema used only within apps/api that does include it
- Implement POST /api/v1/auth/signup accepting email, password, and role (restricted to stylist_owner for self-service signup at this stage — client accounts are created via the OTP flow in the next prompt, not this endpoint), hashing the password with argon2 (or bcrypt if the team prefers — pick one and use it consistently for the rest of the project) before storage, and never returning password_hash in any response
- Implement POST /api/v1/auth/login accepting email and password, verifying against the stored hash, and returning a session (session issuance itself is fully implemented in Prompt 3.4 — for now, return a placeholder access token structure that Prompt 3.4 will replace, and clearly comment this in the code as a known placeholder)
- Enforce password strength requirements at the Zod schema validation layer (minimum length, not solely composition rules that push users toward predictable patterns) with clear validation error messages
- Follow the standard success/error envelope and VALIDATION_ERROR conventions from Chapter 2 for all responses
- Write unit tests for password hashing/verification and integration tests for the signup and login endpoints, including the case of a duplicate email/phone signup attempt

Do not implement OTP, OAuth, or token rotation yet — those are separate prompts. Do not implement any role-permission checks on other resources yet — that begins in Chapter 4.
```

**Expected Output:** A `users` table migration, shared and internal Zod schemas, working `/signup` and `/login` endpoints with password hashing, validation, and standard error handling, plus passing unit and integration tests.

**Success Criteria:**

- Signing up with a valid email/password/role creates a user record with a securely hashed password and no plaintext password ever logged or stored
- Attempting to sign up with a duplicate email or phone number returns a clear `CONFLICT` error, not a raw database constraint error leaking to the client
- Login with correct credentials succeeds; login with incorrect credentials returns `UNAUTHORIZED` without revealing whether the email or the password was wrong
- All new code passes lint, typecheck, and the CI pipeline from Chapter 1

**Dependencies:** Chapter 1 (database, module conventions), Chapter 2 (API conventions, shared types)

---

### Prompt 3.2 — Implement Phone-Based OTP Verification

**Category:** Authentication — Client Onboarding
**Objective:** Implement the lightweight, phone-OTP-based verification flow that allows a client to be created and verified without a full password-based account, per the Playbook's requirement that clients should be able to book without friction.

**Context:** Requires Prompt 3.1 (users table must exist) and Chapter 2's background job infrastructure is not required here, but Chapter 2's shared type conventions are. This prompt also establishes the messaging-provider integration pattern that Chapter 11 (Messaging) and Chapter 12 (Notifications) will reuse — flag this connection explicitly in the implementation.

**Prompt:**

```
Implement phone-based OTP verification for client account creation and login, in src/modules/auth/.

Requirements:
- Add an otp_codes table: id, phone_number, code_hash (never store the raw OTP), expires_at (5 minutes from creation), consumed_at (nullable), created_at, attempt_count (integer, default 0)
- Implement POST /api/v1/auth/otp/request accepting a phone_number, generating a random 6-digit code, hashing it before storage, and sending it via SMS through a messaging provider abstraction (create this as a clean interface, e.g., a SmsProvider interface with a Twilio implementation, in src/shared/messaging/ — this abstraction will be reused by Chapter 11's messaging feature and Chapter 12's notifications, so keep it provider-agnostic rather than calling the Twilio SDK directly from this module)
- Implement POST /api/v1/auth/otp/verify accepting phone_number and code, checking the hashed code against the stored value, enforcing single-use (mark consumed_at on success, reject any further verify attempts against that code), enforcing the 5-minute expiry, and enforcing a maximum of 5 attempts per code before requiring a new code to be requested
- On successful verification, if no user exists with that phone_number, create a new user with role: client and phone_verified_at set to now; if a user already exists with that phone_number, treat this as a login and proceed to session issuance (again using the Prompt 3.4 placeholder until that prompt lands)
- Rate-limit /otp/request to a maximum of 5 requests per phone number per hour, returning RATE_LIMITED with a clear retry-after indication when exceeded, using a Redis-backed counter (the Redis instance already configured in Chapter 1/2)
- Write integration tests covering: successful verification, expired code rejection, exceeded-attempt rejection, replay of an already-consumed code, and rate-limit enforcement on repeated requests
```

**Expected Output:** An `otp_codes` table, a provider-agnostic SMS abstraction with a Twilio implementation, working `/otp/request` and `/otp/verify` endpoints with expiry/single-use/attempt-limit enforcement, Redis-backed rate limiting, and passing integration tests for all listed cases.

**Success Criteria:**

- A generated OTP is never retrievable in plaintext from the database — only its hash is stored
- Verifying an already-consumed code fails with a clear, specific error distinct from an expired or incorrect code
- The 6th OTP request within an hour from the same phone number is rejected with `RATE_LIMITED`
- A new client user record is created only after successful verification, never before

**Dependencies:** Prompt 3.1

---

### Prompt 3.3 — Implement OAuth (Google/Apple) Login

**Category:** Authentication — Alternative Login
**Objective:** Add Google and Apple OAuth as alternative login methods for stylist accounts, using a standard authorization-code-with-PKCE flow, linking to the same `users` table established in Prompt 3.1.

**Context:** Requires Prompt 3.1. Independent of Prompt 3.2 (OTP) — these two prompts can be built in either order or in parallel sessions, since they touch different code paths, but both must land before Prompt 3.4 (session/token handling), which unifies session issuance across all three login methods.

**Prompt:**

```
Implement Google and Apple OAuth login in src/modules/auth/, for stylist accounts, using authorization-code flow with PKCE.

Requirements:
- Add an oauth_identities table: id, user_id (FK to users), provider (enum: google, apple), provider_user_id (text, unique per provider), created_at — a user may have zero, one, or both OAuth identities linked, in addition to or instead of a password
- Implement the standard OAuth redirect/callback endpoints (e.g., GET /api/v1/auth/oauth/:provider/start and GET /api/v1/auth/oauth/:provider/callback), using a well-maintained OAuth client library rather than hand-rolling the token exchange
- On successful OAuth callback: if an oauth_identities record already exists for that provider_user_id, log in as the linked user; if the OAuth email matches an existing user's email but no oauth_identities record exists yet, link the new OAuth identity to that existing account (with the user's implicit consent via completing the OAuth flow) rather than creating a duplicate account; if neither matches, create a new user with role: stylist_owner and email populated from the OAuth profile
- Store OAuth access/refresh tokens (if retained at all, e.g., for future calendar sync in Chapter 8) encrypted at rest, never in plaintext, using an encryption utility established in src/shared/security/ that later chapters (e.g., Chapter 8's Google Calendar sync) will also use
- Follow the same placeholder session-issuance pattern from Prompts 3.1/3.2 pending Prompt 3.4
- Write integration tests using a mocked OAuth provider response covering: new user creation, linking to an existing email-matched account, and login via an already-linked identity
```

**Expected Output:** An `oauth_identities` table, working Google/Apple OAuth start/callback endpoints, correct account-linking logic for the three scenarios described, encrypted token storage, and passing integration tests against a mocked provider.

**Success Criteria:**

- A brand-new Google login creates exactly one new user and one linked `oauth_identities` record
- A Google login using an email that matches an existing password-based account links to that account rather than creating a duplicate
- Stored OAuth tokens are confirmed encrypted at rest by inspecting the raw database value in a test
- A second login via the same provider/provider_user_id reuses the existing linked account without creating a duplicate

**Dependencies:** Prompt 3.1

---

### Prompt 3.4 — Implement Session/Refresh Token Handling with Rotation

**Category:** Authentication — Session Management
**Objective:** Replace the placeholder session logic from Prompts 3.1-3.3 with the real, unified session issuance system: short-lived JWT access tokens plus rotating refresh tokens with reuse detection, per the Engineering Playbook's Identity chapter.

**Context:** Requires Prompts 3.1, 3.2, and 3.3 (all three login methods must exist so this prompt can wire real session issuance into each of their placeholder points). This is one of the highest-security-sensitivity prompts in the entire library — review its output especially carefully.

**Prompt:**

```
Implement unified session and refresh token handling in src/modules/auth/, and wire it into the three existing login flows (password login, OTP verification, OAuth callback) in place of their current placeholder token logic.

Requirements:
- Add a sessions table: id, user_id (FK), refresh_token_hash (text — never store the raw refresh token), expires_at (30 days from issuance), revoked_at (nullable), device_metadata (jsonb — user agent and IP, for anomaly detection), created_at
- Issue a short-lived (15 minute) JWT access token on successful login, signed with a secret from the environment variable system (Chapter 1), containing user_id and role as claims, and nothing sensitive beyond that (no phone number, no email, in the token payload itself)
- Issue a refresh token (a high-entropy random string, not a JWT) alongside it, store only its hash in the sessions table, and return the raw refresh token to the client for storage in an HttpOnly, Secure, SameSite cookie (for apps/web) or secure storage (for future mobile clients)
- Implement POST /api/v1/auth/refresh: accepts the refresh token cookie, verifies its hash against a non-revoked, non-expired sessions record, issues a new access token AND a new refresh token, invalidates (revokes) the old session record, and creates a new one — this is rotation
- Implement reuse detection: if a refresh token is presented that matches a session already marked revoked_at, treat this as a signal of token theft — revoke the entire session family for that user (all sessions tied to the same original login chain, or conservatively all sessions for that user_id if a family concept isn't modeled) and require full re-authentication
- Implement POST /api/v1/auth/logout: revokes the current session immediately
- Wire this into Prompts 3.1 (password login and signup), 3.2 (OTP verify), and 3.3 (OAuth callback) by replacing their placeholder token issuance with a call to this shared session-issuance function — do not duplicate session logic across the three login modules
- Write integration tests for: normal refresh rotation, reuse-detection triggering on a replayed old refresh token, logout revoking the session, and an expired refresh token being rejected
```

**Expected Output:** A `sessions` table, unified session-issuance and refresh/rotation logic, reuse-detection handling, logout endpoint, all three login flows updated to use this shared logic instead of placeholders, and passing integration tests for all listed scenarios.

**Success Criteria:**

- A successful login from any of the three methods (password, OTP, OAuth) results in an access token and a refresh-token cookie issued through the same shared code path
- Calling `/refresh` with a valid refresh token issues a new token pair and revokes the old session record
- Replaying an already-rotated (revoked) refresh token triggers full session-family revocation, verified by a test asserting all of that user's sessions are revoked afterward
- No raw refresh token value is ever found in the database — only hashes

**Dependencies:** Prompts 3.1, 3.2, 3.3

---

### Prompt 3.5 — Implement Account Recovery Flows

**Category:** Authentication — Account Recovery
**Objective:** Implement password reset (for password-based stylist accounts) and phone-number-recovery-adjacent support tooling, per the Playbook's note that phone number changes should not be self-service given their tie to payout identity.

**Context:** Requires Prompts 3.1 and 3.4 (password auth and session issuance must exist). This prompt also introduces the first admin-assisted (support) flow, which anticipates Chapter 19's Admin Panel, so keep the underlying data model general enough that Chapter 19 can build a UI on top of it rather than needing to re-model it.

**Prompt:**

```
Implement account recovery flows in src/modules/auth/.

Requirements:
- Implement POST /api/v1/auth/password-reset/request: accepts an email, and if a matching stylist account exists, sends a time-limited (30 minute), single-use reset link/token via email (create an EmailProvider abstraction analogous to the SmsProvider abstraction from Prompt 3.2, since this is the first email-sending need in the project and later chapters — e.g., booking confirmations — may also need it). Always return the same success response whether or not the email matches an account, to avoid leaking which emails are registered
- Implement POST /api/v1/auth/password-reset/confirm: accepts the reset token and a new password, validates the token (unexpired, unused), updates password_hash, marks the token consumed, and revokes all existing sessions for that user (forcing re-login everywhere, since a password reset may indicate a compromised account)
- Implement a support-assisted phone-number-change request model: rather than a self-service endpoint, create a phone_number_change_requests table (id, user_id, requested_phone_number, status: pending/approved/rejected, requested_at, resolved_at, resolved_by nullable FK to an admin user) and a POST /api/v1/auth/phone-change/request endpoint that only creates the request record — actually applying the change requires a separate, admin-only action that will be exposed through the Admin Panel in Chapter 19 (implement the underlying service function now, e.g., approvePhoneChangeRequest, but it does not need an admin-facing route yet since Chapter 4 hasn't defined admin role-guards yet — leave a clear TODO comment referencing Chapter 19)
- Write integration tests for: successful password reset end to end (including session revocation afterward), expired/already-used reset token rejection, and creation of a phone-change request record
```

**Expected Output:** Working password-reset request/confirm endpoints with an email-provider abstraction, session revocation on reset, and a phone-number-change request model with the underlying (not-yet-exposed) admin approval function, plus passing tests.

**Success Criteria:**

- Requesting a password reset for a non-existent email returns an identical response to requesting it for a real one
- Confirming a valid reset token successfully changes the password and revokes all of that user's existing sessions, verified by testing that a previously issued access token's associated session is now revoked
- An expired or already-used reset token is rejected with a clear error
- A phone-change request is recorded in `pending` status and is not automatically applied

**Dependencies:** Prompts 3.1, 3.4

---

### Prompt 3.6 — Implement Rate Limiting on Auth Endpoints

**Category:** Authentication — Abuse Prevention
**Objective:** Apply consistent, Redis-backed rate limiting across every authentication endpoint built in this chapter, closing the gap left by Prompt 3.2's OTP-specific limiting to cover login, password reset, and OAuth callback abuse as well.

**Context:** Requires all prior prompts in this chapter (3.1-3.5), since this prompt audits and applies a consistent policy across every endpoint they created. This is the chapter's closing "hardening pass" prompt — a pattern that will repeat at the end of several later chapters as well.

**Prompt:**

```
Apply consistent rate limiting across all authentication endpoints implemented in this chapter, using the Redis-backed rate-limiting utility pattern already established for OTP requests in Prompt 3.2 — generalize that utility into a reusable src/shared/security/rate-limit.ts module rather than leaving rate-limiting logic duplicated or OTP-specific.

Requirements:
- Apply rate limiting to: POST /auth/login (e.g., 10 attempts per phone/email per 15 minutes, then temporarily lock further attempts), POST /auth/otp/request (already implemented in Prompt 3.2 — refactor to use the new shared utility rather than duplicate logic), POST /auth/password-reset/request (e.g., 5 requests per email per hour), and the OAuth callback endpoints (rate-limited per IP address, since there is no user identifier to key on before the callback resolves)
- The shared rate-limit utility should accept a key (e.g., a normalized phone number, email, or IP), a limit, and a time window, and return whether the request is allowed plus a retry-after value if not — following the standard RATE_LIMITED error envelope from Chapter 2 when a limit is exceeded
- Ensure rate-limit keys are normalized consistently (e.g., email lowercased, phone numbers in consistent E.164 format) so an attacker cannot bypass limits through trivial formatting variations
- Add a security-focused integration test suite, src/modules/auth/security.test.ts, explicitly testing that each of the four endpoint categories above correctly rejects requests once its limit is exceeded, and that the retry-after value is accurate

Do not weaken any limit already established in Prompt 3.2 while refactoring it into the shared utility — this prompt should only generalize the mechanism, not change OTP's specific limit values.
```

**Expected Output:** A generalized, reusable rate-limiting utility in `src/shared/security/rate-limit.ts`, applied consistently across all four categories of auth endpoint, a refactored (not weakened) OTP rate limit, and a dedicated security test suite.

**Success Criteria:**

- All four endpoint categories are confirmed, via automated tests, to correctly reject requests once their respective limits are exceeded
- Rate-limit keys are demonstrated to be normalized (e.g., a test confirms `Test@Example.com` and `test@example.com` share the same rate-limit bucket)
- The OTP endpoint's specific limit (5 per hour, from Prompt 3.2) is unchanged after refactoring, verified by a regression test
- `docs/API_CONVENTIONS.md` or a new `docs/SECURITY.md` documents the rate limits applied to each endpoint, for future chapters to reference when adding their own rate-limited endpoints

**Dependencies:** Prompts 3.1, 3.2, 3.3, 3.4, 3.5

---

## Chapter 3 Summary

At the end of this chapter, the platform has a complete, production-grade identity system: password and OAuth login for stylists, OTP-based lightweight accounts for clients, rotating refresh tokens with theft detection, account recovery, and consistent rate limiting across every auth surface. Every later chapter that requires "the current user" or "a verified client" builds directly on this foundation.

**This chapter's prompts should never be reordered relative to their internal dependencies** (3.4 must follow 3.1-3.3; 3.6 must follow everything else in the chapter) even though 3.2 and 3.3 can be built in parallel sessions if needed. Chapter 4 (User Roles & Permissions) begins immediately after this chapter and depends on the `role` field and session claims established here.

---

Ready to proceed to Chapter 4 (User Roles & Permissions) when you are.
