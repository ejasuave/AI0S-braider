# Calendar & availability (Chapter 8)

## MVP scope

| Prompt | Status      | Deliverable                                            |
| ------ | ----------- | ------------------------------------------------------ |
| 8.1    | Complete    | `GET /api/v1/bookings/availability` computation engine |
| 8.2    | Deferred V2 | Google Calendar two-way sync                           |
| 8.3    | Complete    | Duration + buffer-aware slot generation                |
| 8.4    | Deferred V2 | Calendar reconciliation job                            |

## How it works

1. Reads `working_hours` and `buffer_minutes` from the stylist profile (Ch.6)
2. Reads `estimated_duration_minutes` from the selected `service_offering`
3. Generates candidate slots at `AVAILABILITY_SLOT_INTERVAL_MINUTES` (default 15)
4. Excludes overlaps with active `held` / `confirmed` bookings (respecting hold TTL)
5. Client holds validate the requested `startTime` against generated slots

**Timezone:** `PLATFORM_TIMEZONE` (default `Europe/London` for UK MVP).

## Response shape

```json
{
  "data": {
    "stylistId": "...",
    "serviceOfferingId": "...",
    "timezone": "Europe/London",
    "slots": [
      {
        "startTime": "2026-08-01T08:00:00.000Z",
        "endTime": "2026-08-01T13:15:00.000Z",
        "durationMinutes": 300,
        "bufferMinutes": 15
      }
    ]
  }
}
```

Slots expose times only — no client identity leakage (Playbook §4.7).

## Manual stylist bookings

`POST /bookings/manual` skips availability validation so stylists can block walk-ins/off-platform appointments.
