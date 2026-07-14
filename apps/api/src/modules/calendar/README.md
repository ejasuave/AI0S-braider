# Calendar module

Owns availability computation and external calendar sync (Chapter 8).

## Boundaries

- **Reads** working hours and exceptions from Stylist Profile (`getBaseAvailabilityRules`)
- **Reads** bookings from Booking Engine for conflict exclusion
- **Does not own** working-hours storage, booking state, or payment capture

## Routes

| Method | Path                                            | Auth    | Description                                      |
| ------ | ----------------------------------------------- | ------- | ------------------------------------------------ |
| GET    | `/api/v1/businesses/:businessId/availability`   | Public  | Slot computation for clients and AI receptionist |
| GET    | `/api/v1/businesses/me/scheduling`              | Stylist | Buffer settings                                  |
| PATCH  | `/api/v1/businesses/me/scheduling`              | Stylist | Update `bufferMinutes`                           |
| GET    | `/api/v1/businesses/me/calendar/status`         | Stylist | Google connection status                         |
| POST   | `/api/v1/businesses/me/calendar/google/connect` | Stylist | OAuth code exchange                              |
| DELETE | `/api/v1/businesses/me/calendar/google`         | Stylist | Disconnect calendar                              |
| POST   | `/api/v1/webhooks/google/calendar`              | Webhook | Inbound Google push notifications                |

Calendar conflicts UI uses existing `/api/v1/businesses/me/calendar-conflicts` routes (Booking module).

## Jobs

- `calendar.reconcile` — every 30 minutes; flags untracked external events, retries failed deletions, renews push subscriptions

## Dev mock mode

When `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are unset, `MockGoogleCalendarApiClient` is used.
When both are set, `RealGoogleCalendarApiClient` calls Google Calendar API v3.

Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (same client ID) so `/stylist/calendar` starts real Google OAuth instead of posting a mock code.
