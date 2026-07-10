# Identity module

Authentication, sessions, OTP, and OAuth for all user roles.

## Routes (`/api/v1/auth`)

| Method | Path                | Description                                     |
| ------ | ------------------- | ----------------------------------------------- |
| POST   | `/register/stylist` | Stylist signup (phone + email + password) → OTP |
| POST   | `/register/client`  | Client signup (phone only) → OTP                |
| POST   | `/login`            | Email/phone + password                          |
| POST   | `/otp/request`      | Request 6-digit SMS OTP                         |
| POST   | `/otp/verify`       | Verify OTP; may issue session                   |
| POST   | `/refresh`          | Rotate refresh token                            |
| POST   | `/logout`           | Revoke session                                  |
| GET    | `/me`               | Current user (Bearer token)                     |
| POST   | `/oauth/google`     | Google OAuth code exchange (PKCE)               |
| POST   | `/oauth/apple`      | Apple Sign In id_token verification             |
| POST   | `/password/forgot`  | Email password reset                            |
| POST   | `/password/reset`   | Reset password with token                       |
| POST   | `/recovery/request` | Support-assisted account recovery ticket        |

## Web clients

Send `X-Client-Type: web` to receive HttpOnly refresh cookie instead of refresh token in JSON.

## Security

- Passwords: Argon2
- OTP: SHA-256 hashed at rest, 5-minute expiry, 5 requests/hour/phone
- Refresh tokens: rotated on every use; reuse revokes session family
- Access tokens: JWT HS256, 15-minute default expiry

Role-based route guards are added in Chapter 4.
