# Security — Project Braids

**Last updated:** 2026-07-11 (Ch.3 Authentication alignment)

Related: [API_CONVENTIONS.md](./API_CONVENTIONS.md) · [PERMISSIONS.md](./PERMISSIONS.md)

---

## Authentication rate limits (Ch.3.6)

Redis-backed counters via `apps/api/src/lib/security/rate-limit.ts` (in-memory in development/test).

| Endpoint                                      | Key                       | Limit | Window     |
| --------------------------------------------- | ------------------------- | ----- | ---------- |
| `POST /api/v1/auth/login`                     | Normalized email or phone | 10    | 15 minutes |
| `POST /api/v1/auth/otp/request`               | Normalized E.164 phone    | 5     | 1 hour     |
| `POST /api/v1/auth/password-reset/request`    | Lowercased email          | 5     | 1 hour     |
| `POST /api/v1/auth/oauth/*` (POST + callback) | Client IP                 | 20    | 1 minute   |

Exceeded limits return `RATE_LIMITED` (429) with `Retry-After` header and `details.retryAfterSeconds`.

---

## OTP (Ch.3.2)

- 6-digit codes; **SHA-256 hash only** stored (`otp_challenges.code_hash`)
- 5-minute expiry; single-use (`consumed_at`)
- Max **5 verify attempts** per code
- Replay of consumed code → `CONFLICT` with `details.reason: OTP_ALREADY_CONSUMED`
- Client accounts created **only after successful OTP verify** (not on `/register/client`)

---

## Sessions (Ch.3.4)

- Access JWT: 15 minutes; claims: `user_id`, `role`, `sessionId` only
- Refresh token: high-entropy random string; **hash only** in `sessions.refresh_token_hash`
- Rotation on `/auth/refresh`; reuse of revoked token revokes entire session family
- Web: refresh token in HttpOnly cookie (`pb_refresh_token`)

---

## OAuth (Ch.3.3)

- Google: authorization-code + PKCE (`GET /auth/oauth/google/start` → callback)
- Apple/Google POST token exchange also supported for SPA/mobile clients
- Provider tokens encrypted at rest (`lib/security/encryption.ts`, AES-256-GCM)
- New Google users → `stylist_owner` with synthetic placeholder phone until verified

---

## Account recovery (Ch.3.5)

- Password reset: 30-minute single-use tokens; **revokes all sessions** on confirm
- Phone number changes: `phone_number_change_requests` — **admin approval only** (`approvePhoneChangeRequest`, Ch.19 UI)

---

## Abuse prevention elsewhere

- Inbound SMS: `lib/messaging-rate-limit.ts` (Ch.13)
- AI receptionist: per-phone turn limits (Ch.13)

New rate-limited endpoints should reuse `assertRateLimit()` from `lib/security/rate-limit.ts`.
