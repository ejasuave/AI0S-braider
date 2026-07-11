# BFF Pattern — Project Braids

**Status:** Chapter 2.4  
**Last updated:** 2026-07-10

## Decision

Project Braids uses a **thin-client architecture**, not a full Backend-for-Frontend.

| Layer                             | Responsibility                                                |
| --------------------------------- | ------------------------------------------------------------- |
| `apps/api`                        | All business logic, validation, persistence, webhooks, jobs   |
| `apps/web`                        | UI rendering, TanStack Query data fetching, client-side state |
| `apps/web` Next.js route handlers | **Web-only transport concerns only**                          |

## What the web app does today

- Calls `apps/api` directly via `src/shared/lib/api-client.ts`
- Prefixes all business calls with `/api/v1/`
- Uses TanStack Query hooks in `src/features/<module>/`
- **No `fetch` in components** — all data access goes through the typed client and hooks

## TanStack Query key convention (Ch.2.4)

Use hierarchical array keys so cache invalidation is predictable:

| Pattern                                   | Example                                         | Invalidate with                               |
| ----------------------------------------- | ----------------------------------------------- | --------------------------------------------- |
| `['<domain>', '<action>']`                | `['system', 'ping']`                            | `queryKey: ['system']`                        |
| `['<domain>', '<action>', params]`        | `['system', 'ping', { page, pageSize }]`        | `queryKey: ['system', 'ping']`                |
| `['messaging', 'conversations', filters]` | `['messaging', 'conversations', 'escalated']`   | `queryKey: ['messaging']`                     |
| `['messaging', 'conversation', id]`       | `['messaging', 'conversation', conversationId]` | `queryKey: ['messaging', 'conversation', id]` |

**Proof:** `usePing` → `['system', 'ping']`; `usePingWithPagination` → `['system', 'ping', { page, pageSize }]`.

## Typed client errors

`ApiClientError` carries `status` and `code` from the standard error envelope. UI layers use `getApiErrorMessage()` — never parse raw `fetch` responses in components.

**Proof:** `apps/web/src/shared/lib/api-client.test.ts` — 401 surfaces `code: 'UNAUTHORIZED'`.

## Allowed Next.js route handlers (BFF)

These are the **only** permitted uses of Next.js API routes / Server Actions:

| Route                         | Purpose                                  |
| ----------------------------- | ---------------------------------------- |
| `app/api/auth/refresh` (Ch.3) | Exchange refresh cookie for access token |
| `app/api/auth/logout` (Ch.3)  | Clear HttpOnly cookies                   |
| `app/api/auth/session` (Ch.3) | Read session metadata for SSR            |

## Forbidden in Next.js route handlers

- Booking creation or modification
- Payment processing
- AI receptionist orchestration
- Direct Prisma queries (except reading session for SSR in Ch.3)
- Duplicated Zod validation (schemas live in `shared-types`, validated on API)

## Why

Native iOS/Android apps will call the same `apps/api` REST endpoints. Business logic in Next.js route handlers would need to be reimplemented on mobile.

## CORS

`apps/api` allows `CORS_ORIGIN` (default `http://localhost:3000`) with credentials for cookie-based auth in Ch.3.
