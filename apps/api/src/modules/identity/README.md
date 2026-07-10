# Identity module

Authentication, sessions, OTP, OAuth, roles, and route guards.

## Routes

### Auth (`/api/v1/auth`)

See route table in this folder's prior docs — registration, login, OTP, OAuth, recovery.

### Access probes (`/api/v1/access`) — Ch.4 guard verification

| Method | Path             | Guard                                     |
| ------ | ---------------- | ----------------------------------------- |
| GET    | `/admin`         | `requireAdmin`                            |
| GET    | `/stylist`       | `requireStylist` + `requireStylistTenant` |
| GET    | `/client`        | `requireClient`                           |
| GET    | `/authenticated` | `requireAuthenticated`                    |

## Guards

Import from `guards.ts`:

```typescript
import { requireStylist, requireStylistTenant } from './guards.js';

app.get('/example', { preHandler: [requireStylist, requireStylistTenant] }, handler);
```

`authenticate` populates `request.auth` with `{ user, sessionId, stylistId }`.

See [docs/PERMISSIONS.md](../../../../docs/PERMISSIONS.md).

## Security

- Passwords: Argon2
- OTP: SHA-256 hashed, 5-minute expiry, 5 requests/hour/phone
- Refresh tokens: rotated; reuse revokes session family
- Access tokens: JWT HS256, 15-minute default

Role-based guards: Chapter 4. Multi-staff scoping (4.3) and impersonation (4.4) are V2.
