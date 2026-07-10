# Build Progress — Project Braids

**Started:** 2026-07-10  
**Objective:** Production-quality MVP per Product Blueprint + Prompt Library Back Matter  
**Current milestone:** Chapter 3 complete — awaiting approval to begin Chapter 4

---

## Completed chapters

| Chapter            | Status   | Notes                                           |
| ------------------ | -------- | ----------------------------------------------- |
| 1 — Project Setup  | Complete | Commit `aba627c`                                |
| 2 — Architecture   | Complete | Commit `13b6544`                                |
| 3 — Authentication | Complete | Identity module, sessions, OTP, OAuth, recovery |

### Chapter 3 deliverables

| Prompt | Deliverable                                                                   |
| ------ | ----------------------------------------------------------------------------- |
| 3.1    | `users` schema, Argon2 passwords, stylist/client registration, login          |
| 3.2    | OTP challenges (6-digit, 5 min), SMS provider abstraction, 5/hour limit       |
| 3.3    | Google (PKCE code exchange) + Apple (id_token) OAuth endpoints                |
| 3.4    | JWT access tokens (15 min) + rotating refresh tokens, HttpOnly cookie for web |
| 3.5    | Password reset email flow, account recovery request tickets                   |
| 3.6    | `@fastify/rate-limit` on auth routes + OTP service-level limits               |

## Pending chapters (MVP critical path)

| Chapter | Name                   | MVP                         |
| ------- | ---------------------- | --------------------------- |
| 4       | User Roles (4.1–4.2)   | Pending (awaiting approval) |
| 6       | Stylist Features       | Pending                     |
| 7       | Booking Engine         | Pending                     |
| 8       | Calendar (8.1, 8.3)    | Pending                     |
| 9       | Payments               | Pending                     |
| 11      | Messaging (SMS)        | Pending                     |
| 12      | Notifications          | Pending                     |
| 13      | AI Receptionist        | Pending                     |
| 17      | Dashboards (17.1–17.3) | Pending                     |
| 23      | Deployment             | Pending                     |
| 24      | Mobile (24.1)          | Pending                     |

## Architectural decisions

| Date       | Decision                                                | Rationale                           |
| ---------- | ------------------------------------------------------- | ----------------------------------- |
| 2026-07-10 | Argon2 for passwords, SHA-256 for OTP/refresh hashes    | Playbook §2.7                       |
| 2026-07-10 | Session `familyId` for refresh rotation theft detection | Playbook §2.7                       |
| 2026-07-10 | `X-Client-Type: web` for HttpOnly refresh cookie        | BFF.md; native gets token in body   |
| 2026-07-10 | Console SMS/email providers in dev/test                 | Twilio wired in Ch.11               |
| 2026-07-10 | OAuth requires pre-existing account link                | Stylists must verify phone first    |
| 2026-07-10 | In-memory rate limit in test env                        | Avoids Redis coupling in unit tests |

## Assumptions

- `JWT_SECRET` ≥ 32 chars required in all environments
- Docker required for full integration test suite (4 auth tests skip without DB)
- Google/Apple OAuth env vars optional until configured

## Technical debt

| Item                                            | Chapter | Notes                                      |
| ----------------------------------------------- | ------- | ------------------------------------------ |
| Twilio SMS provider replaces console provider   | 11      | OTP currently logs to console in dev       |
| Email provider (Resend/Postmark) for production | 12      | Console provider in dev                    |
| Role-based route guards                         | 4       | `/me` uses authenticate only; RBAC in Ch.4 |
| PII encryption at rest                          | 20      | Playbook requirement; not yet implemented  |

## Future improvements

- Passkey/WebAuthn (Playbook §2.8)
- OpenAPI spec from shared-types

## Blockers

| Item | Status |
| ---- | ------ |
| —    | —      |
