# Payments integration contracts (Chapters 7 + 9)

Booking Engine owns state transitions. Payments owns capture/refund execution. This document is the stable contract between them.

## Deposit confirmation — `confirmBooking(bookingId)`

**Caller:** `PaymentService.captureDepositFromWebhook()` after `payment_intent.succeeded`.

**Location:** `apps/api/src/modules/booking/service.ts`

### Success

```typescript
{ outcome: 'confirmed', booking: Booking }
```

- Booking must be `held` with a non-expired `hold_expires_at`
- Transitions `held → confirmed`, sets `deposit_status = paid`, clears `hold_expires_at`
- Idempotent: already-`confirmed` bookings return success without error

### Expired hold race

```typescript
{ outcome: 'hold_expired', booking: Booking, refundRequired: true }
```

When payment arrives after `hold_expires_at`, the booking **must not** be confirmed. Payments must refund the captured deposit and mark `deposit_status = refunded`.

`PaymentService` implements this via `refundCapturedDeposit(bookingId)`.

## Cancellation — `cancelBooking(actor, bookingId, reason)`

**Returns:**

```typescript
{
  booking: Booking;
  depositDisposition: 'full_refund' | 'forfeit_deposit' | 'no_action';
}
```

- `full_refund` — cancellation within `cancellation_window_hours` (Ch.6 policy)
- `forfeit_deposit` — cancellation outside the window; Payments should forfeit captured deposit
- Callable by client (`POST /bookings/mine/:id/cancel`) or stylist (`POST /bookings/:id/cancel`)

Payments Ch.9.3 should consume `depositDisposition` — do not re-derive policy logic.

## No-show — `markNoShow(stylistId, bookingId)`

**Returns:** same `BookingActionResult` shape as cancel.

- `forfeit_deposit` when `no_show_fee_type` is `forfeit_deposit` or `flat_fee`
- `no_action` when `no_show_fee_type` is `no_fee`

Requires `can_manage_bookings`.

## Slot conflicts

Hold creation throws `409 SLOT_UNAVAILABLE` when the stylist slot is taken. Payments and Receptionist should surface a user-friendly message and re-offer alternatives.

## Do not

- Update `bookings.status` from Payments routes
- Confirm bookings without calling `confirmBooking()`
- Skip refund when `hold_expired` is returned
