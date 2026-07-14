# Booking module

Owns `booking` domain logic per `docs/ARCHITECTURE.md` (Chapter 7).

- **Table:** `bookings`, `calendar_conflicts`
- **Routes:** `/api/v1/bookings/*`, calendar conflicts on `/api/v1/businesses/me/calendar-conflicts`
- **Jobs:** `booking.expire-hold`, `booking.sweep-expired-holds` (every minute)
- **Docs:** [`docs/BOOKING_STATE_MACHINE.md`](../../../docs/BOOKING_STATE_MACHINE.md), [`docs/PAYMENTS_INTEGRATION.md`](../../../docs/PAYMENTS_INTEGRATION.md)

## Service venue (business default)

Stylists set a venue mode on `PATCH /businesses/me`: `remote` | `stylist_location` | `come_to_client`, plus optional `workplaceAddress` and `homeVisitSurcharge`.

Holds snapshot the mode onto `bookings`. Clients must supply `clientVisitAddress` (and ideally `clientDisplayName`) for home visits. Workplace street address is shown to clients only after confirmation.

## Chapter 7 deliverables

| Prompt | Deliverable                                                                                     |
| ------ | ----------------------------------------------------------------------------------------------- |
| 7.1    | `transitionBookingStatus()` — centralized state machine                                         |
| 7.2    | TTL holds, `FOR UPDATE` conflicts, `POST /bookings/hold`                                        |
| 7.3    | `confirmBooking()` + expired-hold contract for Ch.9; `pushToExternalCalendar` → Calendar module |
| 7.4    | Policy-driven cancel/no-show with `depositDisposition`                                          |
| 7.5    | `POST /bookings/manual` — confirmed immediately, optional client/service                        |
| 7.6    | `hasConflictingBooking`, `calendar_conflicts` + flag/resolve API                                |

## Tenant scoping

Stylist routes filter by `auth.stylistId`. Client holds/cancels use authenticated client user id.

Do not capture payments here — use `confirmBooking()` from Payments on deposit capture.
