# API Conventions — Project Braids

**Version:** v1 (`/api/v1/`)  
**Last updated:** 2026-07-10

---

## REST standards

- **JSON** request and response bodies (`Content-Type: application/json`)
- **nouns** for resources: `/api/v1/bookings`, `/api/v1/stylists/:id/services`
- **HTTP verbs:** GET (read), POST (create/action), PATCH (partial update), DELETE (remove)
- **UUIDs** in path parameters for entity IDs
- **Timestamps** in ISO 8601 UTC (`timestamptz` in DB)

### Versioning

All business endpoints are prefixed `/api/v1/`. Breaking changes require `/api/v2/`.

Health probes (`/health`, `/health/db`) are unversioned for infrastructure compatibility.

---

## Standard success responses

### Single resource

```json
{
  "data": { "id": "…", "…": "…" }
}
```

### Collection

```json
{
  "data": [ … ],
  "meta": { "total": 42, "page": 1, "pageSize": 20 }
}
```

### Action result (no resource body)

```json
{
  "data": { "status": "accepted" }
}
```

---

## Standard error envelope

Every error from `/api/v1/*` uses this shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable summary",
    "details": {}
  }
}
```

### Error codes

| Code                  | HTTP | When                                 |
| --------------------- | ---- | ------------------------------------ |
| `VALIDATION_ERROR`    | 400  | Zod / request validation failed      |
| `UNAUTHORIZED`        | 401  | Missing or invalid auth              |
| `FORBIDDEN`           | 403  | Authenticated but not permitted      |
| `NOT_FOUND`           | 404  | Resource does not exist              |
| `CONFLICT`            | 409  | State conflict (e.g. double booking) |
| `RATE_LIMITED`        | 429  | Too many requests                    |
| `INTERNAL_ERROR`      | 500  | Unexpected server error              |
| `SERVICE_UNAVAILABLE` | 503  | Dependency down (e.g. Redis)         |

Implementation: `ApiError` class in `apps/api/src/lib/errors.ts`.

---

## Authentication (Chapter 3)

- **Web:** Send `X-Client-Type: web`; refresh token returned as HttpOnly cookie on `/api/v1/auth/*`
- **Native:** Refresh token in JSON response body
- **Access:** `Authorization: Bearer <jwt>` on protected routes
- **OTP:** `POST /api/v1/auth/otp/request` then `/otp/verify`
- **Roles:** Enforced in middleware from Chapter 4 onward

Implementation: `apps/api/src/modules/identity/`

---

## Webhooks

Inbound webhooks live at `/api/v1/webhooks/<provider>/`.

### Idempotent processing sequence

1. **Verify** — Validate provider signature (Stripe-Signature, Twilio signature, etc.)
2. **Dedupe** — `SELECT` from `processed_webhook_events` by `event_id`; return 200 if already processed
3. **Process** — Execute business logic in a transaction
4. **Record** — Insert `event_id` into `processed_webhook_events`

Return **200** for successfully processed or already-processed events. Return **4xx** only for malformed/unsigned payloads.

### Retry safety

Providers retry on non-2xx. Handlers must never double-apply side effects.

---

## Pagination

Query parameters: `?page=1&pageSize=20` (default pageSize: 20, max: 100).

---

## Request tracing

Clients may send `X-Request-Id` (UUID). API echoes it in response headers and logs.
