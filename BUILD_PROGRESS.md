# Build Progress — Project Braids

**Started:** 2026-07-10  
**Objective:** Production-quality MVP per Product Blueprint + Prompt Library Back Matter  
**Current milestone:** Chapter 6 complete — awaiting approval to begin Chapter 7

---

## Completed chapters

| Chapter                  | Status   | Notes                                          |
| ------------------------ | -------- | ---------------------------------------------- |
| 1 — Project Setup        | Complete | `aba627c`                                      |
| 2 — Architecture         | Complete | `13b6544`                                      |
| 3 — Authentication       | Complete | `921b99f`                                      |
| 4 — User Roles (4.1–4.2) | Complete | `ef0cb45`                                      |
| 6 — Stylist Features     | Complete | Profile, portfolio, pricing taxonomy, policies |

### Chapter 6 deliverables (MVP scope)

| Prompt | Deliverable                                                          |
| ------ | -------------------------------------------------------------------- |
| 6.1    | `stylist_profiles` + `GET/PATCH /api/v1/profile/me`                  |
| 6.2    | Manual portfolio CRUD + multipart upload via `StorageProvider`       |
| 6.3    | Deferred V2 — Instagram import                                       |
| 6.4    | `service_offerings` + seeded taxonomy + deterministic pricing lookup |
| 6.5    | Deposit & cancellation policy JSON on profile                        |
| 6.6    | Working hours + buffer minutes on profile                            |

## Pending chapters (MVP critical path)

| Chapter | Name                | MVP                         |
| ------- | ------------------- | --------------------------- |
| 7       | Booking Engine      | Pending (awaiting approval) |
| 8       | Calendar (8.1, 8.3) | Pending                     |
| 9       | Payments            | Pending                     |
| 11      | Messaging (SMS)     | Pending                     |
| 12      | Notifications       | Pending                     |
| 13      | AI Receptionist     | Pending                     |
| 17      | Dashboards          | Pending                     |
| 23      | Deployment          | Pending                     |
| 24      | Mobile (24.1)       | Pending                     |

## Architectural decisions

| Date       | Decision                                  | Rationale                                       |
| ---------- | ----------------------------------------- | ----------------------------------------------- |
| 2026-07-10 | `auth.stylistId` = `stylist_profiles.id`  | True tenant key; resolves via profile module    |
| 2026-07-10 | `LocalStorageProvider` for dev uploads    | Supabase Storage adapter deferred to deployment |
| 2026-07-10 | Pricing lookup returns confidence scores  | Feeds Ch.13 escalation threshold (0.8)          |
| 2026-07-10 | `style_categories` reference table + seed | Guided onboarding per Playbook §3.5             |

## Technical debt

| Item                                       | Chapter | Notes                              |
| ------------------------------------------ | ------- | ---------------------------------- |
| Supabase `StorageProvider` production impl | 6       | Local disk only for now            |
| PostGIS `location` on profile              | 6       | Using `locationArea` text for MVP  |
| Instagram portfolio import                 | 6.3 V2  | Schema has `instagram` source enum |

## Blockers

| Item | Status |
| ---- | ------ |
| —    | —      |
