# Payments module

Owns `payments` and `stylist_stripe_accounts` per `docs/PAYMENTS.md`.

- Routes: `routes.ts` — Connect onboarding, deposits, Stripe webhook
- Service: `service.ts` — deposit creation, capture, Connect sync
- Provider: `apps/api/src/lib/stripe/` — `StripeProvider` abstraction (live + mock)

Cross-module: calls `bookingService.confirmBookingAfterDeposit()` on capture — do not update `bookings` directly from routes.
