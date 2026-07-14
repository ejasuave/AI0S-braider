# Notifications module

Owns reminder scheduling, transactional delivery, and delivery-worker preference checks per `ARCHITECTURE.md`.

- **Repository:** `repository.ts` — `notifications`, reads `notification_preferences` via client-preferences
- **Service:** `service.ts` — enqueue/deliver, booking lifecycle handlers (invoked via domain events)
- **Events:** `events.ts` — subscribes to `booking-confirmed`, `booking-cancelled`, `booking-no-show`, `booking-time-changed`
- **Content:** `content.ts` — `generateNotificationContent()` templated stub (Ch.13 may enrich)
- **Jobs:** `notifications.deliver`, `notifications.sweep-due`, `notifications.sweep-reminders`

## Event-driven integration (Ch.12.2/12.3)

Booking Engine emits lifecycle events from `lib/domain-events.ts`. This module subscribes in `events.ts` — Booking does **not** import Notifications.

Registered via `import '../notifications/events.js'` in `booking/routes.ts`.

## Preference gating

| Type                                             | Gated by `appointment_reminders_enabled` | Gated by `marketing_messages_enabled` |
| ------------------------------------------------ | ---------------------------------------- | ------------------------------------- |
| `reminder_48h`, `reminder_2h`                    | Yes                                      | No                                    |
| `confirmation`, `cancellation`, `no_show_notice` | No                                       | No                                    |

See `preference-gating.ts` and `docs/COMPLIANCE.md`.

## Blueprint STOP override (Ch.12.4)

STOP halts **AI + marketing** but **still allows** reminders unless the client disables them in profile. Implemented in `client-preferences` module.

## Booking time change

`onBookingTimeChanged` cancels pending reminders and reschedules. **Chapter 7 does not yet emit `emitBookingTimeChanged`** when a confirmed booking is rescheduled — add that emission when reschedule is implemented.

## Does not own

- SMS transport (`messaging` module)
- STOP/START storage (`client-preferences` module, Ch.5.4)
- AI turn logic (`receptionist` module)
