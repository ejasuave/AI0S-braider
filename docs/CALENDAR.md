# Calendar & availability (Chapter 8)

## Scope

| Prompt | Status   | Deliverable                                                                 |
| ------ | -------- | --------------------------------------------------------------------------- |
| 8.1    | Complete | `GET /api/v1/businesses/:businessId/availability` — public slot computation |
| 8.2    | Complete | Google Calendar two-way sync, webhooks, `pushToExternalCalendar`            |
| 8.3    | Complete | Buffer-aware slot generation (`buffer_minutes`, default 15)                 |
| 8.4    | Complete | `calendar.reconcile` job every 30 minutes                                   |

Module: `apps/api/src/modules/calendar/`. See [ARCHITECTURE.md](../ARCHITECTURE.md).

## How availability works

1. Calls `getBaseAvailabilityRules` (Ch.6) for per-day windows and exceptions
2. Loads active `held` / `confirmed` bookings (respecting hold TTL)
3. Pads existing bookings by `buffer_minutes` on both sides (Ch.8.3)
4. Generates candidates at `AVAILABILITY_SLOT_INTERVAL_MINUTES` (default 15)
5. Filters candidates whose full duration + buffer would overlap padded bookings

**Timezone:** `PLATFORM_TIMEZONE` (default `Europe/London`).

**Range cap:** `AVAILABILITY_MAX_DAYS` (default 60).

## Endpoints

- **Public:** `GET /businesses/:businessId/availability?serviceOfferingId=…` or `durationMinutes=…`
- **Legacy (authenticated):** `GET /bookings/availability` — delegates to the same engine
- **Scheduling:** `GET/PATCH /businesses/me/scheduling` — buffer configuration

## Google Calendar sync

- Connect: `POST /businesses/me/calendar/google/connect` with OAuth `code` + `redirectUri`
- Confirmed bookings push events to Google; cancellations delete them
- Inbound webhook: `POST /webhooks/google/calendar` — flags untracked events via `flagExternalCalendarConflict` (never silent block)
- Reconciliation job catches missed webhooks and renews push subscriptions

### Real vs mock mode

| Mode     | When                                                       | Behaviour                                                     |
| -------- | ---------------------------------------------------------- | ------------------------------------------------------------- |
| **Live** | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set on the API | `RealGoogleCalendarApiClient` talks to Google Calendar API v3 |
| **Mock** | Either secret unset                                        | In-memory mock (tests / local without Google Cloud)           |

Also set on the web app:

- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — same client ID; starts Google OAuth from `/stylist/calendar`

Google Cloud Console setup:

1. Create an OAuth 2.0 Web client
2. Authorized redirect URI: `http://localhost:3000/stylist/calendar` (and production URL)
3. Enable **Google Calendar API**
4. Scopes: `https://www.googleapis.com/auth/calendar.events`

**Localhost note:** Google push webhooks require a public HTTPS `API_PUBLIC_URL`. Without a tunnel, connect still succeeds and **outbound** create/delete sync works; inbound updates rely on the 30-minute reconcile job.

Disconnect any previous **dev mock** connection after enabling live keys, then Connect again.

## Frontend

- `/stylist/calendar` — connect Google, buffer minutes, conflict list
- `/book` — public availability before client sign-in (hold still requires auth)

## Manual stylist bookings

`POST /bookings/manual` skips availability validation so stylists can block walk-ins/off-platform appointments.
