# Profile module (legacy compat)

Directory search and legacy `/api/v1/profile/*` routes. **New Ch.6 features** use `modules/stylist-profile/` and `/api/v1/businesses/me/*`.

See [stylist-profile/README.md](../stylist-profile/README.md) for the canonical Ch.6 module.

## MVP scope

| Prompt    | Status                           | Canonical route    |
| --------- | -------------------------------- | ------------------ |
| 6.1–6.6   | Implemented in `stylist-profile` | `/businesses/me/*` |
| Directory | `modules/profile/`               | `/directory/*`     |

Directory listing/detail and `GET /profile/stylists/:id/booking-page` include `photoUrl` and per-service `offerings[].portfolio` galleries (plus a flat `portfolio` list for cover/compat).

Legacy `/profile/*` routes remain for backward compatibility and delegate to shared data where applicable.
