# Payments (Chapter 9)

Stripe Connect onboarding, deposit PaymentIntents, and idempotent webhook handling.

## Scope (MVP)

| Prompt | Status   | Notes                                                                          |
| ------ | -------- | ------------------------------------------------------------------------------ |
| 9.1    | Done     | `POST /api/v1/payments/connect/onboard`, `GET /connect/status`                 |
| 9.2    | Done     | `POST /api/v1/payments/deposits` — destination charge on connected account     |
| 9.3    | Deferred | Refund/forfeiture on cancellation (V2 follow-up)                               |
| 9.4    | Done     | `POST /api/v1/webhooks/stripe` — signature verify + `processed_webhook_events` |
| 9.5    | Deferred | Payout scheduling                                                              |
| 9.6    | Deferred | Chargeback evidence                                                            |

## Flow

1. Stylist completes Stripe Connect onboarding (`/payments/connect/onboard` → hosted link).
2. Client creates a booking hold (Ch.7).
3. Client requests deposit payment (`POST /payments/deposits`) → receives `clientSecret` for Stripe-hosted UI.
4. Stripe sends `payment_intent.succeeded` webhook → payment `captured`, booking `held` → `confirmed`, `deposit_status` → `paid`.

## Local development

When `STRIPE_SECRET_KEY` is unset, the API uses `MockStripeProvider`:

- Connect onboarding URLs are mock redirects.
- Deposit PaymentIntents use `pi_mock_*` IDs.
- `POST /payments/deposits/:bookingId/simulate-success` (non-production, mock Stripe only) creates a pending deposit if needed, provisions mock Connect when missing, then captures without Stripe.
- Webhook tests sign payloads with `mock_<hmac>` using `STRIPE_WEBHOOK_SECRET` or `mock_webhook_secret`.

Set real Stripe test keys for sandbox integration:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_RETURN_URL=http://localhost:3000/stylist/payments
STRIPE_CONNECT_REFRESH_URL=http://localhost:3000/stylist/payments
```

## Tables

- `stylist_stripe_accounts` — Connect account linkage per stylist profile
- `payments` — one deposit PaymentIntent per booking
- `processed_webhook_events` — idempotency ledger (Ch.2.6)

## Module boundaries

- **Owns:** `payments`, `stylist_stripe_accounts`, Stripe webhook handling for payment events
- **Calls:** `bookingService.confirmBookingAfterDeposit()` on successful capture (no direct booking table writes elsewhere)
- **Does not own:** pricing/deposit policy (profile module), slot holds (booking module)

## Security

- No card data on platform servers — client secret / Stripe-hosted elements only.
- Webhook signature verified on every request; unsigned requests rejected.
- Payout bank details live in Stripe Connect only.
