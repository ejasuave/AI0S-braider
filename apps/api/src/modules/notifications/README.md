# Notifications module

Owns reminder scheduling, transactional delivery, and SMS STOP compliance per `docs/ARCHITECTURE.md`.

- **Repository:** `repository.ts` — `notifications`, `sms_preferences`
- **Service:** `service.ts` — enqueue/deliver, booking lifecycle hooks
- **Jobs:** `notifications.deliver`, `notifications.sweep-due`, `notifications.sweep-reminders`
- **Content:** delegates copy to `receptionist/notification-content.ts`

## Blueprint STOP override (Ch.12.4)

STOP halts **AI conversations + marketing** but **still allows** transactional notifications (confirmations, reminders, deposit links).

## Does not own

- SMS transport (`messaging` module)
- AI turn logic (`receptionist` module)
