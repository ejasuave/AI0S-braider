# Stylist Profile module (Chapter 6)

Owns business configuration per `docs/ARCHITECTURE.md`: bio, portfolio, profile photo, structured pricing, policies, and availability rules.

- **Module path:** `apps/api/src/modules/stylist-profile/`
- **Tables:** `businesses` (extended), `business_policies`, `working_hours`, `schedule_exceptions`, `portfolio_items`, `service_offerings`, `style_categories`, `instagram_connections`; profile photo on `stylist_profiles`
- **Routes:** `/api/v1/businesses/me/*` (including `/me/photo*`), public `/api/v1/style-categories`, `/api/v1/businesses/:businessId/services|policy`
- **Storage:** pre-signed uploads via `lib/storage` (`StorageProvider.createPresignedUploadUrl`)
- **Client surfaces:** directory listing/detail and public booking page expose `photoUrl` + portfolio images

## Prompt coverage

| Prompt | Deliverable                                                                                                                        |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 6.1    | `POST/GET/PATCH /businesses`, onboarding completion gate, `can_manage_profile`                                                     |
| 6.2    | Portfolio upload-url, register, reorder, delete; **service-scoped** galleries (10/service, 50 business-wide); profile photo upload |
| 6.3    | Instagram connect/import, encrypted tokens, `INSTAGRAM_ACCOUNT_INELIGIBLE`, refresh job                                            |
| 6.4    | Seeded `style_categories`, structured `service_offerings`, soft-delete                                                             |
| 6.5    | `business_policies` with defaults (20% deposit), cross-module `getBusinessPolicy`                                                  |
| 6.6    | `working_hours`, `schedule_exceptions`, `getBaseAvailabilityRules` for Ch.8                                                        |

## Instagram prerequisite

Requires a registered Meta developer app with Instagram API credentials in environment variables. The codebase ships a mock client for tests/local dev.

## Legacy `/profile/*` routes

Retained for backward compatibility; new features should use `/businesses/me/*`.

## Custom styles and AI

Custom (`isCustomStyle: true`) offerings are lower-confidence inputs for the AI Receptionist (Ch.13). See `docs/API_CONVENTIONS.md`.
