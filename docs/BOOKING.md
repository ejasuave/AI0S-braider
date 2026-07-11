# Booking engine (Chapter 7)

See [`BOOKING_STATE_MACHINE.md`](./BOOKING_STATE_MACHINE.md) for the full state diagram and [`PAYMENTS_INTEGRATION.md`](./PAYMENTS_INTEGRATION.md) for Ch.9 contracts.

## State machine (summary)

```
held ──► confirmed ──► completed
  │          │
  │          ├──► cancelled
  │          └──► no_show
  └──► cancelled (incl. hold_expired)
```

Invalid transitions return `VALIDATION_ERROR`. Terminal states: `completed`, `cancelled`, `no_show`.

## Holds & concurrency

- Default hold TTL: **15 minutes** (`BOOKING_HOLD_TTL_MINUTES`)
- Hold creation runs in a transaction with `SELECT … FOR UPDATE` overlap check
- Expired holds are cancelled with `cancellation_reason = hold_expired`
- Background job `booking.expire-hold` scheduled per hold (requires Redis worker)

**Success criterion (M4):** two simultaneous hold requests for the same slot → exactly one `201`, one `409 CONFLICT`.

## Price snapshot

`agreed_price` and `agreed_duration_minutes` are copied from `service_offerings` at booking creation. Profile price changes apply prospectively only (Blueprint pricing integrity).

## API

| Method | Path                            | Actor   |
| ------ | ------------------------------- | ------- |
| `POST` | `/api/v1/bookings/holds`        | Client  |
| `POST` | `/api/v1/bookings/manual`       | Stylist |
| `GET`  | `/api/v1/bookings`              | Stylist |
| `GET`  | `/api/v1/bookings/:id`          | Stylist |
| `POST` | `/api/v1/bookings/:id/confirm`  | Stylist |
| `POST` | `/api/v1/bookings/:id/cancel`   | Stylist |
| `POST` | `/api/v1/bookings/:id/complete` | Stylist |
| `POST` | `/api/v1/bookings/:id/no-show`  | Stylist |

Deposit capture is Chapter 9 — `confirm` does not charge yet.

## Availability (Chapter 8)

```
GET /api/v1/bookings/availability?stylistId=...&serviceOfferingId=...&from=...&to=...&limit=20
```

See [`docs/CALENDAR.md`](./CALENDAR.md) for slot generation rules.
