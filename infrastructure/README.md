# Local infrastructure

## With Docker (recommended)

```bash
pnpm infra:up
# or: docker compose -f infrastructure/docker-compose.yml up -d
```

Services:

- Postgres: `postgresql://braids:braids@localhost:5432/braids_dev`
- Redis: `redis://localhost:6379`

## Without Docker

If Docker is not running, `pnpm infra:up` starts **Prisma Dev** local Postgres instead.

Update `.env`:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:51214/braids_dev?sslmode=disable
```

Then run `pnpm db:migrate:deploy` and restart `pnpm dev`.

Redis (background jobs, rate limiting) still requires Docker.
