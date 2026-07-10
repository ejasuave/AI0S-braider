# Build Progress — Project Braids

**Started:** 2026-07-10  
**Objective:** Production-quality MVP per Product Blueprint + Prompt Library Back Matter  
**Current milestone:** Chapter 7 complete — awaiting approval to begin Chapter 8

---

## Completed chapters

| Chapter                  | Status   | Notes                                              |
| ------------------------ | -------- | -------------------------------------------------- |
| 1 — Project Setup        | Complete | `aba627c`                                          |
| 2 — Architecture         | Complete | `13b6544`                                          |
| 3 — Authentication       | Complete | `921b99f`                                          |
| 4 — User Roles (4.1–4.2) | Complete | `ef0cb45`                                          |
| 6 — Stylist Features     | Complete | `7ef6e26`                                          |
| 7 — Booking Engine       | Complete | State machine, holds, concurrency, manual bookings |

### Chapter 7 deliverables (MVP scope)

| Prompt | Deliverable                                                     |
| ------ | --------------------------------------------------------------- |
| 7.1    | Booking state machine with guarded transitions                  |
| 7.2    | TTL holds + `FOR UPDATE` overlap detection + expiry job         |
| 7.3    | `POST /bookings/:id/confirm` (deposit capture deferred to Ch.9) |
| 7.4    | Cancel + no-show endpoints                                      |
| 7.5    | `POST /bookings/manual` for stylist dashboard bookings          |
| 7.6    | Conflict detection + concurrency integration test               |

## Pending chapters (MVP critical path)

| Chapter | Name                | MVP                         |
| ------- | ------------------- | --------------------------- |
| 8       | Calendar (8.1, 8.3) | Pending (awaiting approval) |
| 9       | Payments            | Pending                     |
| 11      | Messaging (SMS)     | Pending                     |
| 12      | Notifications       | Pending                     |
| 13      | AI Receptionist     | Pending                     |
| 17      | Dashboards          | Pending                     |
| 23      | Deployment          | Pending                     |
| 24      | Mobile (24.1)       | Pending                     |

## Architectural decisions

| Date       | Decision                                             | Rationale                          |
| ---------- | ---------------------------------------------------- | ---------------------------------- |
| 2026-07-10 | Price/duration snapshotted on booking create         | Blueprint pricing integrity        |
| 2026-07-10 | `SELECT … FOR UPDATE` overlap check in transaction   | Playbook 7.6 concurrency guarantee |
| 2026-07-10 | Expired holds → `cancelled` + `hold_expired` reason  | Matches playbook state machine     |
| 2026-07-10 | Booking service calls `profileService` for offerings | Cross-module boundary rule         |

## Technical debt

| Item                         | Chapter | Notes                                       |
| ---------------------------- | ------- | ------------------------------------------- |
| Deposit capture on confirm   | 9       | `deposit_status` stays `pending` until Ch.9 |
| Availability slot generation | 8       | Ch.7 accepts explicit `startTime` only      |
| Google Calendar sync         | 8 V2    | Not in MVP                                  |

## Blockers

| Item | Status |
| ---- | ------ |
| —    | —      |
