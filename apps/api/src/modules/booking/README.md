# Booking module

Owns `booking` domain logic per `docs/ARCHITECTURE.md` (Chapter 7).

- **Table:** `bookings`
- **Routes:** `/api/v1/bookings/*`
- **Jobs:** `booking.expire-hold`, `booking.sweep-expired-holds`

## MVP scope (Ch.7)

| Prompt | Deliverable                                                                    |
| ------ | ------------------------------------------------------------------------------ |
| 7.1    | State machine (`held` → `confirmed` → `completed` \| `cancelled` \| `no_show`) |
| 7.2    | TTL holds + `FOR UPDATE` conflict detection                                    |
| 7.3    | `POST /bookings/:id/confirm` (payment wiring in Ch.9)                          |
| 7.4    | Cancel + no-show endpoints                                                     |
| 7.5    | `POST /bookings/manual` for dashboard-created bookings                         |
| 7.6    | Overlap detection + concurrency test                                           |

## Tenant scoping

Stylist routes filter by `auth.stylistId`. Client holds use authenticated `client` user id.

Do not capture payments here — deposit status remains `pending` until Chapter 9.
