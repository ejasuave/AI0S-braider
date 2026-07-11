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
- OTP: SHA-256 hashed, 5-minute expiry, 5 requests/hour/phone (shared `lib/security/rate-limit.ts`)
- Refresh tokens: rotated; reuse revokes session family
- Access tokens: JWT HS256, 15-minute default
- OAuth tokens: AES-256-GCM encrypted at rest
- Rate limits: login 10/15min, OTP 5/hour, password-reset 5/hour, OAuth 20/min per IP — see [docs/SECURITY.md](../../../../docs/SECURITY.md)

### Routes (`/api/v1/auth`)

| Method | Path                                                           | Notes                                                          |
| ------ | -------------------------------------------------------------- | -------------------------------------------------------------- |
| POST   | `/signup`                                                      | Stylist self-service (alias of `/register/stylist`)            |
| POST   | `/register/stylist`, `/register/client`                        | Stylist signup + client OTP start (no client row until verify) |
| POST   | `/login`, `/otp/request`, `/otp/verify`, `/refresh`, `/logout` | Core session flows                                             |
| GET    | `/oauth/:provider/start`, `/callback`                          | Google PKCE redirect flow                                      |
| POST   | `/oauth/google`, `/oauth/apple`                                | Token exchange for SPA/mobile                                  |
| POST   | `/password-reset/request`, `/confirm`                          | Aliases: `/password/forgot`, `/password/reset`                 |
| POST   | `/phone-change/request`                                        | Authenticated; creates pending admin request (Ch.19)           |

Role-based guards: Chapter 4. Multi-staff scoping (4.3) and impersonation (4.4) are V2.
