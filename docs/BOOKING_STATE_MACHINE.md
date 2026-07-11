# Booking state machine (Chapter 7)

## States

| Status      | Terminal | Description                          |
| ----------- | -------- | ------------------------------------ |
| `held`      | No       | Temporary slot hold pending deposit  |
| `confirmed` | No       | Deposit paid or stylist confirmed    |
| `completed` | Yes      | Appointment finished                 |
| `cancelled` | Yes      | Cancelled by client, stylist, or TTL |
| `no_show`   | Yes      | Stylist marked client as no-show     |

## Legal transitions

```
held ──► confirmed
held ──► cancelled   (hold_expired, client/stylist cancel)

confirmed ──► completed
confirmed ──► cancelled
confirmed ──► no_show
```

No other transitions are legal. Invalid transitions return `VALIDATION_ERROR`.

## Implementation

All status changes go through `transitionBookingStatus()` in `apps/api/src/modules/booking/state-machine.ts`. Do not set `bookings.status` directly outside this function.

## Entry exceptions

| Source             | Initial status | Notes                                               |
| ------------------ | -------------- | --------------------------------------------------- |
| `client_direct`    | `held`         | Standard deposit flow                               |
| `ai_agent`         | `held`         | Same as client_direct                               |
| `dashboard_manual` | `confirmed`    | Stylist blocks time with authority — no TTL/deposit |

Manual bookings may omit `client_id` and `service_offering_id` when blocking calendar time with `duration_minutes` only.

## Hold expiry

- Default TTL: **15 minutes** (`BOOKING_HOLD_TTL_MINUTES`)
- Per-hold delayed job: `booking.expire-hold`
- Recurring sweep: `booking.sweep-expired-holds` (every minute)
- Expired holds transition `held → cancelled` with `cancellation_reason = hold_expired`

## Concurrency

Hold creation uses `SELECT … FOR UPDATE` overlap checks. Conflicting requests receive `409 SLOT_UNAVAILABLE`.

## Cross-chapter interfaces

- **Ch.9 Payments:** `confirmBooking(bookingId)` — see [`PAYMENTS_INTEGRATION.md`](./PAYMENTS_INTEGRATION.md)
- **Ch.8 Calendar:** `pushToExternalCalendar(bookingId)` stub in `external-calendar.ts`
- **Ch.8 Reconciliation:** `flagExternalCalendarConflict()` in `calendar-conflicts.ts`

## API

| Method | Path                                                   | Actor                           |
| ------ | ------------------------------------------------------ | ------------------------------- |
| `POST` | `/api/v1/bookings/hold`                                | Client (alias: `/holds`)        |
| `POST` | `/api/v1/bookings/manual`                              | Stylist (`can_manage_bookings`) |
| `GET`  | `/api/v1/bookings/:id`                                 | Stylist                         |
| `GET`  | `/api/v1/bookings/mine/:id`                            | Client                          |
| `POST` | `/api/v1/bookings/:id/confirm`                         | Stylist                         |
| `POST` | `/api/v1/bookings/:id/cancel`                          | Stylist                         |
| `POST` | `/api/v1/bookings/mine/:id/cancel`                     | Client                          |
| `POST` | `/api/v1/bookings/:id/no-show`                         | Stylist (`can_manage_bookings`) |
| `POST` | `/api/v1/bookings/:id/complete`                        | Stylist                         |
| `GET`  | `/api/v1/businesses/me/calendar-conflicts`             | Stylist (`can_manage_bookings`) |
| `POST` | `/api/v1/businesses/me/calendar-conflicts/:id/resolve` | Stylist                         |
