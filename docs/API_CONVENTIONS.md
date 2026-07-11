# API Conventions — Project Braids

**Version:** v1 (`/api/v1/`)  
**Last updated:** 2026-07-11 (Ch.2 alignment)

See also: [ARCHITECTURE.md](../ARCHITECTURE.md) · [BFF.md](./BFF.md) · [BACKGROUND_JOBS.md](./BACKGROUND_JOBS.md) · [WEBHOOK_CONVENTIONS.md](./WEBHOOK_CONVENTIONS.md)

---

## REST standards

- **JSON** request and response bodies (`Content-Type: application/json`)
- **nouns** for resources: `/api/v1/bookings`, `/api/v1/profile/me`
- **HTTP verbs:** GET (read), POST (create/action), PATCH (partial update), DELETE (remove)
- **UUIDs** in path parameters for entity IDs
- **Timestamps** in ISO 8601 UTC (`timestamptz` in DB)

### Versioning

All business endpoints are prefixed `/api/v1/`. Breaking changes require `/api/v2/` — never mutate v1 behaviour in place.

Health probes (`/health`, `/health/db`) are unversioned for infrastructure compatibility.

---

## Standard success responses

### Single resource

```json
{
  "data": { "id": "…", "…": "…" }
}
```

### Collection with pagination meta

```json
{
  "data": [ … ],
  "meta": { "total": 42, "page": 1, "pageSize": 20 }
}
```

Implementation: `sendData()` in `apps/api/src/lib/http.ts`.

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
| `SERVICE_UNAVAILABLE` | 503  | Dependency down (e.g. DB, Redis)     |

Implementation: `ApiError` in `apps/api/src/lib/errors.ts`; global handler in `apps/api/src/app.ts`.

**Proof:** `GET /api/v1/ping?pageSize=500` → `VALIDATION_ERROR` with field details.

---

## Request pipeline (middleware chain)

Every `/api/v1/*` request passes through (in order):

| Step                  | Implementation                                                     |
| --------------------- | ------------------------------------------------------------------ |
| 1. Request ID         | Fastify `genReqId` / `x-request-id` header (`apps/api/src/app.ts`) |
| 2. Structured logging | Pino request/response logs (Ch.1.8)                                |
| 3. CORS + cookies     | `@fastify/cors`, `@fastify/cookie`                                 |
| 4. Route handler      | Per-route `preHandler`: `authenticate`, `requireStylist`, etc.     |
| 5. Input validation   | Zod `.parse()` / `.safeParse()` before business logic              |
| 6. Rate limiting      | Per-route (auth, messaging) where applicable                       |
| 7. Error envelope     | Global `setErrorHandler` maps Zod → `VALIDATION_ERROR`             |

Webhook routes skip step 4 user auth; signature verification replaces it — see [WEBHOOK_CONVENTIONS.md](./WEBHOOK_CONVENTIONS.md).

---

## Shared types (Ch.2.3)

**Single source of truth:** `packages/shared-types/src/api/<domain>.ts`

### Correct pattern

```typescript
// packages/shared-types/src/api/pagination.ts
export const paginationParamsSchema = z.object({ page: z.coerce.number()… });
export type PaginationParams = z.infer<typeof paginationParamsSchema>;
```

Both `apps/api` and `apps/web` import from `@project-braids/shared-types/api`.

### Anti-pattern (forbidden)

```typescript
// apps/api/src/types/booking.ts  ← WRONG: duplicate
export type Booking = { id: string; … };

// apps/web/src/types/booking.ts  ← WRONG: will drift
export interface Booking { id: string; … }
```

Changing a field in the shared Zod schema must cause typecheck failures in both apps — that is the drift-prevention guarantee.

**Proof:** `paginationParamsSchema` used in `GET /api/v1/ping` and `usePingWithPagination` hook.

---

## Pagination

Query parameters: `?page=1&pageSize=20` (defaults: page 1, pageSize 20, max pageSize 100).

Schema: `paginationParamsSchema` in `@project-braids/shared-types/api`.

Some list endpoints use `limit`/`offset` (e.g. messaging Ch.11) — new list APIs should prefer `page`/`pageSize` unless offset pagination is required.

---

## Authorization guards (Chapter 4)

Insert after `authenticate`, before route validation:

```typescript
import { requireRole, requireBusinessPermission } from '../roles/guards.js';

app.get('/resource', { preHandler: [requireRole('stylist_owner', 'stylist_staff')] }, handler);
app.patch(
  '/businesses/:businessId/staff/:id',
  { preHandler: [requireBusinessPermission('can_manage_staff')] },
  handler,
);
```

`FORBIDDEN` rejections emit structured `permission_denied` logs. See [PERMISSIONS.md](./PERMISSIONS.md).

### Stylist profile routes (Chapter 6)

Business configuration lives under `/api/v1/businesses/me/*`, guarded by `can_manage_profile`, `can_manage_pricing`, or `can_manage_bookings` as appropriate. Public reference data: `GET /api/v1/style-categories`; public offerings: `GET /api/v1/businesses/:businessId/services`.

**Custom style offerings:** When a stylist creates a service with `customStyleName` instead of a seeded `styleCategoryId`, the offering is stored with `isCustomStyle: true`. Future AI consumers (Ch.13 Receptionist, Ch.14 Style Recognition) must treat these as **lower-confidence** for price/duration lookup — prefer seeded taxonomy matches and escalate below the 0.8 confidence threshold rather than quoting from custom names alone.

---

## Authentication (Chapter 3+)

- **Web:** `X-Client-Type: web`; refresh token HttpOnly cookie on `/api/v1/auth/*`
- **Access:** `Authorization: Bearer <jwt>` on protected routes
- **Roles:** `requireRole`, `requireBusinessPermission`, `requireStylist`, `requireClient` — `modules/roles/guards.ts`

---

## Webhooks

Full sequence and rationale: [WEBHOOK_CONVENTIONS.md](./WEBHOOK_CONVENTIONS.md).

Utility: `processWebhookIdempotently()` in `apps/api/src/lib/webhooks/idempotent-handler.ts`.

---

## Request tracing

Clients may send `X-Request-Id` (UUID). API generates one if absent and includes `reqId` in logs.

---

## Example endpoint (Ch.2.2)

`GET /api/v1/ping` — returns `{ data: { pong: true, timestamp, service, meta? } }`.
