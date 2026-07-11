# Permissions — Project Braids

**Status:** Chapter 4 complete (prompts 4.1–4.4)  
**Last updated:** 2026-07-11

## Roles

| Role            | Scope                            | `stylistId` in auth context | `businessId` in auth context        |
| --------------- | -------------------------------- | --------------------------- | ----------------------------------- |
| `admin`         | Platform-wide                    | `null`                      | `null`                              |
| `stylist_owner` | Single stylist business (tenant) | `stylist_profiles.id`       | `businesses.id` (one per owner)     |
| `stylist_staff` | Employed by one business         | Owner's profile id          | Active `business_staff.business_id` |
| `client`        | Platform-wide client             | `null`                      | `null`                              |

Coarse roles live on `users.role`. Fine-grained flags live on `business_staff.permissions` (JSONB).

## Business permission flags (Ch.4.1)

| Flag                  | Purpose                            |
| --------------------- | ---------------------------------- |
| `can_manage_bookings` | Booking list/actions               |
| `can_manage_pricing`  | Service offerings and pricing      |
| `can_view_payouts`    | Stripe Connect / payout visibility |
| `can_manage_staff`    | Invite, update, remove staff       |

`stylist_owner` implicitly has all flags for their business (no `business_staff` row required).

Staff rows are **inactive** when `accepted_at` is null or `removed_at` is set — permissions JSON is ignored in those cases.

## Route guards

Implemented in `apps/api/src/modules/roles/guards.ts` (re-exported from `identity/guards.ts` for backward compatibility):

| Helper                                              | Purpose                                                                 |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| `requireRole(...roles)`                             | Coarse JWT role check; logs `permission_denied` on rejection            |
| `requireBusinessPermission(flag)`                   | Owner always allowed; staff checked against active `business_staff` row |
| `rejectImpersonationOnSensitiveRoutes`              | Blocks impersonation tokens on sensitive mutations (Ch.4.4)             |
| `requireStylist` / `requireClient` / `requireAdmin` | Convenience wrappers                                                    |

### Middleware order (Ch.2)

```
authenticate → requireRole / requireBusinessPermission → rejectImpersonation (if sensitive) → Zod validation → handler
```

### Usage

```typescript
app.get(
  '/businesses/:businessId/staff',
  { preHandler: [requireBusinessPermission('can_manage_staff')] },
  handler,
);
```

### Verification endpoints

| Route                                        | Guard                                              |
| -------------------------------------------- | -------------------------------------------------- |
| `GET /api/v1/access/admin`                   | `requireAdmin`                                     |
| `GET /api/v1/access/stylist`                 | `requireStylist`                                   |
| `GET /api/v1/access/client`                  | `requireClient`                                    |
| `GET /api/v1/access/stylist-only`            | `requireRole('stylist_owner', 'stylist_staff')`    |
| `GET /api/v1/businesses/:id/permission-demo` | `requireBusinessPermission('can_manage_bookings')` |

## Staff management API (Ch.4.3)

Full lifecycle: invite → accept → patch permissions → soft-remove (`removed_at`).

Invitation notifications reuse Ch.3 `SmsProvider` / `EmailProvider`.

## Admin impersonation (Ch.4.4)

- `POST /api/v1/admin/impersonate/:targetUserId` — 5-minute scoped access token (`imp` claim)
- Distinct audit logs: `impersonation_started`, `impersonated_request`
- Sensitive-route denylist documented in [SECURITY.md](./SECURITY.md)

## Tenant scoping rule

Stylist-owned data must filter by `auth.stylistId`. Business permission routes use `businessId` from params or `auth.businessId`.
