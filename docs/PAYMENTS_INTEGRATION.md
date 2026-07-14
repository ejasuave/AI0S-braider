# Payments integration contracts (Chapters 7 + 9)

Booking Engine owns state transitions. Payments owns capture/refund execution. This document is the stable contract between them.

## Deposit confirmation — `confirmBooking(bookingId)`

**Caller:** `PaymentService.captureDepositFromWebhook()` after `payment_intent.succeeded`.

**Location:** `apps/api/src/modules/booking/service.ts`

### Success

```typescript
{ outcome: 'confirmed', booking: Booking }
```

### Expired hold race

```typescript
{ outcome: 'hold_expired', booking: Booking, refundRequired: true }
```

Payments calls `processRefund(bookingId, 'full')` — issues a Stripe refund and marks the payment `refunded`.

## Cancellation / no-show — domain events (Ch.9.3)

Booking Engine **does not import** Payments. After `cancelBooking` or `markNoShow`, it emits:

```typescript
emitBookingDepositDisposition({ bookingId, depositDisposition });
```

Payments subscribes in `apps/api/src/modules/payments/events.ts` and maps:

| `depositDisposition` | Payments action                                   |
| -------------------- | ------------------------------------------------- |
| `full_refund`        | `processRefund(..., 'full')`                      |
| `forfeit_deposit`    | `processRefund(..., 'none')` → status `forfeited` |
| `no_action`          | skip                                              |

## Policy snapshot (Ch.9.6)

New holds store `bookings.policy_snapshot` (JSON) at creation time. Dispute evidence assembly uses this snapshot rather than live policy rows.

**Extension point:** `assembleDisputeEvidence()` includes `conversationHistory: null` until Chapters 11/13 populate SMS/AI transcripts.

## Stripe Connect readiness — `isPaymentReady(businessId)`

**Location:** `apps/api/src/modules/payments/readiness.ts`

Booking holds with `depositAmount > 0` are rejected with `422` when this returns `false`.

## Endpoints (Chapter 9)

| Method | Path                                    | Auth                                      |
| ------ | --------------------------------------- | ----------------------------------------- |
| GET    | `/businesses/me/stripe/onboarding-link` | `can_view_payouts`                        |
| POST   | `/businesses/me/stripe/onboarding-link` | `can_view_payouts`                        |
| GET    | `/businesses/me/stripe/status`          | `can_view_payouts`                        |
| GET    | `/businesses/me/payouts`                | `can_view_payouts`                        |
| GET    | `/businesses/me/income-report`          | `can_view_payouts`                        |
| POST   | `/bookings/:bookingId/deposit`          | client                                    |
| POST   | `/bookings/:bookingId/partial-refund`   | `can_view_payouts`                        |
| POST   | `/payments/deposits`                    | client (legacy alias)                     |
| POST   | `/payments/deposits/:bookingId/sync`    | client — confirm after Stripe.js checkout |
| POST   | `/webhooks/stripe`                      | Stripe signature                          |

## Do not

- Update `bookings.status` from Payments routes directly
- Confirm bookings without calling `confirmBooking()`
- Re-derive cancellation policy in Payments — consume `depositDisposition` only
