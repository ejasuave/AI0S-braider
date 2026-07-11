# Local infrastructure (Ch.1.7)

## With Docker (recommended)

```bash
pnpm infra:up
# or: docker compose up -d
```

Services:

- Postgres: `postgresql://braids:braids@localhost:5432/braids_dev`
- Redis: `redis://localhost:6379`

Compose file: root `docker-compose.yml` includes `infrastructure/docker-compose.yml`.

## Without Docker

If Docker is not running, `pnpm infra:up` starts **Prisma Dev** local Postgres instead.

Update `.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:51214/braids_dev?sslmode=disable
```

Then run `pnpm db:migrate:deploy` and restart `pnpm dev`.

Redis (background jobs, rate limiting) still requires Docker.
