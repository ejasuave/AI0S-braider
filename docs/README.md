# Documentation

| File                                                             | Purpose                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------- |
| [ARCHITECTURE.md](../ARCHITECTURE.md)                            | Service boundaries, cross-module rules (canonical: repo root) |
| [SECURITY.md](./SECURITY.md)                                     | Auth rate limits, OTP/session/OAuth security (Ch.3)           |
| [BFF.md](./BFF.md)                                               | Thin-client vs Next.js BFF boundary                           |
| [PERMISSIONS.md](./PERMISSIONS.md)                               | Role matrix and route guard conventions (Ch.4)                |
| [PROFILE.md](./PROFILE.md)                                       | Stylist profile, pricing taxonomy, catalogs, policies (Ch.6)  |
| [BOOKING.md](./BOOKING.md)                                       | Booking state machine, holds, concurrency (Ch.7)              |
| [CALENDAR.md](./CALENDAR.md)                                     | Availability engine and slot generation (Ch.8)                |
| [PAYMENTS.md](./PAYMENTS.md)                                     | Stripe Connect, deposits, webhooks (Ch.9)                     |
| [MESSAGING.md](./MESSAGING.md)                                   | Conversations, web chat, SMS ingress (Ch.11)                  |
| [AI_RECEPTIONIST_EVALUATION.md](./AI_RECEPTIONIST_EVALUATION.md) | Golden-set regression + session persistence notes (Ch.13.8)   |
| [AI_RECEPTIONIST_SECURITY.md](./AI_RECEPTIONIST_SECURITY.md)     | Injection / escalation taxonomy (Ch.13.6–13.7)                |
| [GOOGLE_REVIEWS.md](./GOOGLE_REVIEWS.md)                         | Google Reviews placeholder / deferred integration             |
| [DEPLOYMENT.md](./DEPLOYMENT.md)                                 | Staging/production, kill switch, rollback (Ch.23)             |
| [MIGRATIONS.md](./MIGRATIONS.md)                                 | Prisma migration safety (Ch.23.4)                             |
| [MOBILE_AUDIT.md](./MOBILE_AUDIT.md)                             | Responsive layout audit and fixes (Ch.24.1)                   |
| [FUTURE_FEATURES.md](./FUTURE_FEATURES.md)                       | Deferred V2/V3 features and trigger conditions (Ch.25)        |

Update these files in the same commit as any behavioural change they describe.

Module READMEs (implementation detail): `apps/api/src/modules/receptionist/README.md`, `apps/api/src/modules/messaging/README.md`, and peers under `apps/api/src/modules/*/README.md`.
