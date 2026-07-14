# Payments (Chapter 9)

Stripe Connect onboarding, deposit PaymentIntents, refunds/forfeiture, payouts reporting, and dispute evidence.

## Scope

| Prompt | Status | Notes                                                           |
| ------ | ------ | --------------------------------------------------------------- |
| 9.1    | Done   | `payment_accounts`, `/businesses/me/stripe/*`, `isPaymentReady` |
| 9.2    | Done   | `createDepositCharge`, `/bookings/:id/deposit`, capture webhook |
| 9.3    | Done   | `processRefund`, domain events, `/bookings/:id/partial-refund`  |
| 9.4    | Done   | Webhook hardening, reconcile script                             |
| 9.5    | Done   | `/businesses/me/payouts`, `/businesses/me/income-report`        |
| 9.6    | Done   | `policy_snapshot`, dispute evidence packages                    |

## Flow

1. Stylist completes Stripe Connect (`POST /businesses/me/stripe/onboarding-link`).
2. Client creates a hold (gated by `isPaymentReady` when deposit > 0).
3. Client pays deposit (`POST /bookings/:id/deposit` or legacy `/payments/deposits`).
4. `payment_intent.succeeded` webhook **or** `POST /payments/deposits/:bookingId/sync` after Stripe.js → booking confirmed.
5. Cancel/no-show → domain event → full refund or forfeit per Ch.7 policy.

## Charge type

**Destination charges** — funds route to the stylist's connected account. See `docs/BUSINESS_MODEL_NOTES.md`.

## Local development

Mock Stripe when `STRIPE_SECRET_KEY` is unset. Use `POST /payments/deposits/:bookingId/simulate-success` in dev.

**Real card testing locally:** set matching **test** keys on API and web (`sk_test_` + `pk_test_`). After paying with test card `4242…`, the web app calls `/payments/deposits/:id/sync` so bookings confirm without Stripe CLI. For production-like webhook testing, run `stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET`. See [STRIPE_LIVE_SETUP.md](./STRIPE_LIVE_SETUP.md).

## Tables

- `payment_accounts` — Stripe Connect per business
- `payments` — deposit PaymentIntent per booking
- `dispute_evidence_packages` — assembled dispute evidence
- `processed_webhook_events` — idempotency ledger

## Reconciliation

```bash
pnpm --filter @project-braids/api exec tsx src/scripts/reconcile-payments.ts
```

See also `docs/PAYMENTS_INTEGRATION.md`.
