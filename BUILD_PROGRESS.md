# Build Progress — Project Braids

**Started:** 2026-07-10  
**Objective:** Production-quality MVP per Product Blueprint + Prompt Library Back Matter  
**Current milestone:** Chapter 8 complete — awaiting approval to begin Chapter 9

---

## Completed chapters

| Chapter                  | Status   | Notes                                                 |
| ------------------------ | -------- | ----------------------------------------------------- |
| 1 — Project Setup        | Complete | `aba627c`                                             |
| 2 — Architecture         | Complete | `13b6544`                                             |
| 3 — Authentication       | Complete | `921b99f`                                             |
| 4 — User Roles (4.1–4.2) | Complete | `ef0cb45`                                             |
| 6 — Stylist Features     | Complete | `7ef6e26`                                             |
| 7 — Booking Engine       | Complete | `5e43991`                                             |
| 8 — Calendar (8.1, 8.3)  | Complete | Availability engine + duration/buffer slot generation |

### Chapter 8 deliverables (MVP scope)

| Prompt | Deliverable                                                        |
| ------ | ------------------------------------------------------------------ |
| 8.1    | `GET /api/v1/bookings/availability` computation engine             |
| 8.2    | Deferred V2 — Google Calendar sync                                 |
| 8.3    | Duration + buffer-aware slot generation from profile working hours |
| 8.4    | Deferred V2 — Calendar reconciliation job                          |

## Pending chapters (MVP critical path)

| Chapter | Name               | MVP                         |
| ------- | ------------------ | --------------------------- |
| 9       | Payments (9.1–9.2) | Pending (awaiting approval) |
| 11      | Messaging (SMS)    | Pending                     |
| 12      | Notifications      | Pending                     |
| 13      | AI Receptionist    | Pending                     |
| 17      | Dashboards         | Pending                     |
| 23      | Deployment         | Pending                     |
| 24      | Mobile (24.1)      | Pending                     |

## Architectural decisions

| Date       | Decision                                        | Rationale                                                |
| ---------- | ----------------------------------------------- | -------------------------------------------------------- |
| 2026-07-10 | Availability logic in `booking` module          | ARCHITECTURE.md — profile owns hours, booking owns slots |
| 2026-07-10 | `Europe/London` default timezone                | UK-only MVP per Blueprint                                |
| 2026-07-10 | Client holds validate against generated slots   | Ties Ch.8 to Ch.7 hold creation                          |
| 2026-07-10 | Manual stylist bookings skip availability check | Walk-in / off-platform blocks per Playbook               |

## Technical debt

| Item                       | Chapter | Notes         |
| -------------------------- | ------- | ------------- |
| Google Calendar sync       | 8.2 V2  | Not in MVP    |
| Calendar reconciliation    | 8.4 V2  | Not in MVP    |
| Deposit capture on confirm | 9       | Still pending |

## Blockers

| Item | Status |
| ---- | ------ |
| —    | —      |
