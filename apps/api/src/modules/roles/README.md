# Roles module

Owns business entities, staff permissions, route guards, and admin impersonation (Ch.4).

## Ownership

- **Owns:** `businesses`, `business_staff`, `impersonation_sessions`, permission evaluation, `requireRole`, `requireBusinessPermission`
- **Does not own:** Stylist profile content (Ch.6), authentication sessions (Ch.3), bookable multi-chair calendars (Ch.25.2 V3)

## Routes

| Method | Path                                                       | Guard                  |
| ------ | ---------------------------------------------------------- | ---------------------- |
| GET    | `/api/v1/businesses/:businessId/permission-demo`           | `can_manage_bookings`  |
| GET    | `/api/v1/businesses/:businessId/staff`                     | `can_manage_staff`     |
| POST   | `/api/v1/businesses/:businessId/staff/invite`              | `can_manage_staff`     |
| POST   | `/api/v1/businesses/:businessId/staff/:staffId/resend`     | `can_manage_staff`     |
| PATCH  | `/api/v1/businesses/:businessId/staff/:staffId`            | `can_manage_staff`     |
| POST   | `/api/v1/businesses/:businessId/staff/:staffId/deactivate` | `can_manage_staff`     |
| DELETE | `/api/v1/businesses/:businessId/staff/:staffId`            | `can_manage_staff`     |
| POST   | `/api/v1/staff/invitations/accept`                         | authenticated + token  |
| POST   | `/api/v1/staff/invitations/:invitationId/accept`           | authenticated (legacy) |
| POST   | `/api/v1/admin/impersonate/:targetUserId`                  | `requireRole('admin')` |
| POST   | `/api/v1/admin/impersonate/end`                            | `requireRole('admin')` |

Verification probes: `GET /api/v1/access/stylist-only`

Invites use hashed tokens (7-day expiry) and Resend when `RESEND_API_KEY` is set. See [docs/PERMISSIONS.md](../../../../docs/PERMISSIONS.md) and [docs/SECURITY.md](../../../../docs/SECURITY.md).
