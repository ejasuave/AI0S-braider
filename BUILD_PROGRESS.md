# Build Progress — Project Braids

**Started:** 2026-07-10  
**Objective:** Production-quality MVP per Product Blueprint + Prompt Library Back Matter  
**Current milestone:** Chapter 4 complete — awaiting approval to begin Chapter 6

---

## Completed chapters

| Chapter                  | Status   | Notes                                   |
| ------------------------ | -------- | --------------------------------------- |
| 1 — Project Setup        | Complete | `aba627c`                               |
| 2 — Architecture         | Complete | `13b6544`                               |
| 3 — Authentication       | Complete | `921b99f`                               |
| 4 — User Roles (4.1–4.2) | Complete | Guards, tenant context, permissions doc |

### Chapter 4 deliverables (MVP scope)

| Prompt | Deliverable                                                                |
| ------ | -------------------------------------------------------------------------- |
| 4.1    | `user_role` enum formalized; `stylist_memberships` table for staff linkage |
| 4.2    | `requireRoles` guards, `auth.stylistId` context, `/api/v1/access/*` probes |
| 4.3    | Deferred V2 — multi-staff permission scoping                               |
| 4.4    | Deferred V2 — admin impersonation                                          |

## Pending chapters (MVP critical path)

| Chapter | Name                                 | MVP                         |
| ------- | ------------------------------------ | --------------------------- |
| 6       | Stylist Features (6.4 pricing first) | Pending (awaiting approval) |
| 7       | Booking Engine                       | Pending                     |
| 8       | Calendar (8.1, 8.3)                  | Pending                     |
| 9       | Payments                             | Pending                     |
| 11      | Messaging (SMS)                      | Pending                     |
| 12      | Notifications                        | Pending                     |
| 13      | AI Receptionist                      | Pending                     |
| 17      | Dashboards (17.1–17.3)               | Pending                     |
| 23      | Deployment                           | Pending                     |
| 24      | Mobile (24.1)                        | Pending                     |

## Architectural decisions

| Date       | Decision                                    | Rationale                                         |
| ---------- | ------------------------------------------- | ------------------------------------------------- |
| 2026-07-10 | `stylist_owner` tenant id = user.id interim | `stylist_profiles` arrives in Ch.6                |
| 2026-07-10 | `stylist_memberships` schema only for staff | Full scoping in Ch.4.3 (V2)                       |
| 2026-07-10 | Guards in `identity/guards.ts`              | Auth + authorization colocated until split needed |
| 2026-07-10 | `/access/*` probe routes                    | Verifies guards without building Ch.6+ features   |

## Assumptions

- Feature routes import guards from `identity/guards.ts`
- `auth.stylistId` is the tenant filter for all stylist-scoped queries

## Technical debt

| Item                                   | Chapter | Notes                                          |
| -------------------------------------- | ------- | ---------------------------------------------- |
| stylist_owner `stylistId` uses user.id | 4       | Replace with `stylist_profiles.id` in Ch.6     |
| Multi-staff permissions                | 4.3 V2  | Membership table exists; scoping logic pending |
| Admin impersonation                    | 4.4 V2  | Not in MVP                                     |

## Blockers

| Item | Status |
| ---- | ------ |
| —    | —      |
