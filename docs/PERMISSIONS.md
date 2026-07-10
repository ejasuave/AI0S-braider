# Permissions — Project Braids

**Status:** Chapter 4 (MVP: prompts 4.1–4.2)  
**Last updated:** 2026-07-10

## Roles

| Role            | Scope                            | `stylistId` in auth context                             |
| --------------- | -------------------------------- | ------------------------------------------------------- |
| `admin`         | Platform-wide                    | `null`                                                  |
| `stylist_owner` | Single stylist business (tenant) | Owner's user id (interim until Ch.6 `stylist_profiles`) |
| `stylist_staff` | Employed by one stylist          | From `stylist_memberships.stylist_id`                   |
| `client`        | Platform-wide client             | `null`                                                  |

Roles are stored on `users.role` (Prisma enum `user_role`).

## MVP permission matrix

| Permission          | Allowed roles                    |
| ------------------- | -------------------------------- |
| `ADMIN_PLATFORM`    | `admin`                          |
| `STYLIST_DASHBOARD` | `stylist_owner`, `stylist_staff` |
| `CLIENT_SELF`       | `client`                         |
| `AUTHENTICATED`     | all roles                        |

Source of truth in code: `packages/shared-types/src/api/permissions.ts`

## Route guards (API)

Guards live in `apps/api/src/modules/identity/guards.ts`:

| Helper                 | Purpose                                                       |
| ---------------------- | ------------------------------------------------------------- |
| `requireRoles(...)`    | Generic role check (runs `authenticate` first)                |
| `requireAdmin`         | Platform admin only                                           |
| `requireStylist`       | `stylist_owner` or `stylist_staff`                            |
| `requireClient`        | Client only                                                   |
| `requireStylistTenant` | Requires resolved `auth.stylistId` (after stylist role check) |

### Usage

```typescript
app.get('/bookings', { preHandler: [requireStylist, requireStylistTenant] }, handler);
```

### Verification endpoints

| Route                              | Guard                                     |
| ---------------------------------- | ----------------------------------------- |
| `GET /api/v1/access/admin`         | `requireAdmin`                            |
| `GET /api/v1/access/stylist`       | `requireStylist` + `requireStylistTenant` |
| `GET /api/v1/access/client`        | `requireClient`                           |
| `GET /api/v1/access/authenticated` | any authenticated role                    |

## Deferred to V2

- **4.3** — Fine-grained `stylist_staff` permission scoping
- **4.4** — Admin impersonation with audit logging

## Tenant scoping rule

All stylist-owned data must filter by `auth.stylistId` from middleware — never trust client-supplied `stylist_id` without verification.
