# Payments module

Owns deposit capture, refunds, Stripe Connect, and dispute evidence per `docs/PAYMENTS_INTEGRATION.md`.

## Routes

| Area                   | Paths                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Business (Ch.9.1, 9.5) | `/businesses/me/stripe/*`, `/businesses/me/payouts`, `/businesses/me/income-report` |
| Deposits (Ch.9.2)      | `/payments/deposits`, `/bookings/:id/deposit`                                       |
| Refunds (Ch.9.3)       | `/bookings/:id/partial-refund`                                                      |
| Webhooks               | `/webhooks/stripe`                                                                  |

Legacy `/payments/connect/*` remains for backward compatibility.

## Key files

- `service.ts` — deposits, refunds, payouts, disputes
- `readiness.ts` — `isPaymentReady(businessId)` for Booking Engine
- `events.ts` — subscribes to `emitBookingDepositDisposition` (no Booking → Payments import)
- `business.routes.ts` — stylist payout/reporting endpoints
- `../lib/stripe/` — `StripeProvider` (live + mock)

## Reconciliation

```bash
pnpm --filter @project-braids/api exec tsx src/scripts/reconcile-payments.ts
```

## Business model

See `docs/BUSINESS_MODEL_NOTES.md` — flat subscription, destination charges, no take-rate at capture.
