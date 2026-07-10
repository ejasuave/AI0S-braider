# Profile module

Owns stylist business configuration per `docs/ARCHITECTURE.md` (Chapter 6).

- **Tables:** `stylist_profiles`, `portfolio_items`, `service_offerings`, `style_categories`
- **Routes:** `/api/v1/profile/*`
- **Storage:** portfolio uploads via `lib/storage` (`StorageProvider` abstraction)

## MVP scope (Ch.6)

| Prompt | Status                                                                    |
| ------ | ------------------------------------------------------------------------- |
| 6.1    | Stylist profile CRUD (`GET/PATCH /profile/me`)                            |
| 6.2    | Manual portfolio upload + URL (`/profile/portfolio`, `/portfolio/upload`) |
| 6.3    | Deferred V2 — Instagram import                                            |
| 6.4    | Structured `service_offerings` + deterministic pricing lookup             |
| 6.5    | Deposit & cancellation policies on profile                                |
| 6.6    | Working hours + buffer minutes on profile                                 |

## Tenant scoping

All stylist routes use `requireStylist` + `requireStylistTenant` and filter by `auth.stylistId` (`stylist_profiles.id`).

Do not query other modules' tables directly.
