# Permissions — Project Braids

**Status:** Chapter 4 complete (prompts 4.1–4.4) + Phase 1 invite hardening + team phone sign-in (2026-07-20)  
**Last updated:** 2026-07-20

## Roles

| Role            | Scope                            | `stylistId` in auth context | `businessId` in auth context        |
| --------------- | -------------------------------- | --------------------------- | ----------------------------------- |
| `admin`         | Platform-wide                    | `null`                      | `null`                              |
| `stylist_owner` | Single stylist business (tenant) | `stylist_profiles.id`       | `businesses.id` (one per owner)     |
| `stylist_staff` | Employed by one business         | Owner's profile id          | Active `business_staff.business_id` |
| `client`        | Platform-wide client             | `null`                      | `null`                              |

Coarse roles live on `users.role`. Fine-grained flags live on `business_staff.permissions` (JSONB).

Team **labels** on `business_staff.role` (`manager` | `stylist` | `receptionist`) map to permission presets. **Owner is not inviteable** — they remain `stylist_owner`.

| Team role    | Bookings | Pricing | Profile | Payouts | Staff |
| ------------ | -------- | ------- | ------- | ------- | ----- |
| Manager      | yes      | yes     | yes     | no      | yes   |
| Stylist      | yes      | no      | no      | no      | no    |
| Receptionist | yes      | no      | no      | no      | no    |

## Business permission flags (Ch.4.1)

| Flag                  | Purpose                            |
| --------------------- | ---------------------------------- |
| `can_manage_bookings` | Booking list/actions               |
| `can_manage_pricing`  | Service offerings and pricing      |
| `can_manage_profile`  | Business profile edits             |
| `can_view_payouts`    | Stripe Connect / payout visibility |
| `can_manage_staff`    | Invite, update, remove staff       |

`stylist_owner` implicitly has all flags for their business (no `business_staff` row required).

Staff rows are **inactive** when `accepted_at` is null, `removed_at` is set, or `deactivated_at` is set — permissions JSON is ignored in those cases.

## Staff invitation flow (Phase 1)

1. Owner/manager `POST /api/v1/businesses/:businessId/staff/invite` with `{ email, role }`
2. API creates `business_staff` with hashed `invite_token_hash` and `invite_expires_at` (7 days)
3. Transactional email via **Resend** (`RESEND_API_KEY`) — HTML + plain text with Accept link `${WEB_APP_URL}/invite/{token}`
4. Invitee opens `/invite/{token}`, signs in if needed, `POST /api/v1/staff/invitations/accept` with `{ token }`
5. Token cleared on accept; reuse and expiry are rejected; user role becomes `stylist_staff`

**Dev/test:** without `RESEND_API_KEY`, email logs to the API console (`ConsoleEmailProvider`).  
**Staging/production:** inviting by email **requires** `RESEND_API_KEY` (fail closed — no silent success). Optional `EMAIL_FROM`.

Also: `POST .../staff/:id/resend`, `POST .../staff/:id/deactivate`, `PATCH` role/displayName, `DELETE` soft-remove.

Legacy `POST /staff/invitations/:invitationId/accept` remains for older tests/links.

### Web sign-in paths (do not mix these up)

| Who                       | Route           | How they authenticate                                         |
| ------------------------- | --------------- | ------------------------------------------------------------- |
| Business owner            | `/login`        | Email + password from stylist registration                    |
| Invited / returning staff | `/login/team`   | Phone OTP (same mobile used for the invite) — **no password** |
| Booking clients           | `/login/client` | Phone OTP                                                     |

Invite accept UI links to `/login/team?next=/invite/{token}` (not client sign-in). Stylist `/login` surfaces a **Team member phone sign in** callout for staff who land on the owner form by mistake.

After OTP verify, redirect uses the **account role** (`stylist_staff` → `/stylist`, `client` → `/client` or stored `next`), not the pending OTP “client” registration path.

Staff do not receive an email/password account in Phase 1. Owners keep email login; staff keep phone OTP.

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

## Admin impersonation (Ch.4.4)

- `POST /api/v1/admin/impersonate/:targetUserId` — 5-minute scoped access token (`imp` claim)
- Distinct audit logs: `impersonation_started`, `impersonated_request`
- Sensitive-route denylist documented in [SECURITY.md](./SECURITY.md)

## Tenant scoping rule

Staff share the owner's `stylistId` for dashboard access. **Bookable multi-stylist chairs** remain V3 ([FUTURE_FEATURES.md](./FUTURE_FEATURES.md) §25.2).
