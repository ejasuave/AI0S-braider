# Webhooks module

Inbound provider webhooks (Stripe, Twilio, etc.).

- Routes: `routes.ts`
- Idempotency: `lib/webhooks/idempotent-handler.ts` (shared)

All handlers must follow the four-step sequence in `docs/API_CONVENTIONS.md`.
