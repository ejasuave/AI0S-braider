# Deployment (Chapter 23)

Ship safely and repeatably: staging on every merge to `main`, production behind manual approval.

## Architecture

| Component  | Recommended host          | Process                                            |
| ---------- | ------------------------- | -------------------------------------------------- |
| `apps/web` | Vercel                    | Serverless Next.js                                 |
| `apps/api` | Fly.io / Railway / Render | Docker (`infrastructure/docker/Dockerfile.api`)    |
| Worker     | Fly.io (separate app)     | Docker (`infrastructure/docker/Dockerfile.worker`) |
| Postgres   | Supabase                  | Managed — **separate project per environment**     |
| Redis      | Upstash / Fly Redis       | BullMQ queues                                      |
| Storage    | Supabase Storage          | Via `StorageProvider`                              |

## Environments

| Environment    | Trigger                                                 | Isolation                           |
| -------------- | ------------------------------------------------------- | ----------------------------------- |
| **Local**      | `pnpm dev`                                              | Docker Compose (`pnpm infra:up`)    |
| **Staging**    | Push to `main` → `.github/workflows/deploy-staging.yml` | Own DB, Stripe test, Twilio staging |
| **Production** | Manual `Deploy Production` workflow                     | Own DB, Stripe live, real Twilio    |

Copy `.env.staging.example` / `.env.production.example` — never share `DATABASE_URL` or Stripe keys across environments.

## CI/CD (23.1)

| Workflow                | When                         | Purpose                                               |
| ----------------------- | ---------------------------- | ----------------------------------------------------- |
| `ci.yml`                | PR + push to `main`          | Lint, format, typecheck, test, build, migration check |
| `deploy-staging.yml`    | Push to `main`               | Full verify + Docker build + staging deploy gate      |
| `deploy-production.yml` | Manual (`workflow_dispatch`) | Requires typing `deploy` to confirm                   |

### First-time platform setup

**Web (Vercel)**

1. Import monorepo; set root directory `apps/web`
2. Build: `pnpm build` (configure install from repo root)
3. Env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_PLATFORM_DISPLAY_NAME`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
4. Staging: deploy previews from `main`; Production: promote after checklist

**API + Worker (Fly.io)**

1. `fly apps create project-braids-api-staging` (and worker app)
2. Copy `infrastructure/fly/api.toml` — set `app` name
3. `fly secrets import < .env.staging` (never commit secrets)
4. `fly deploy --config infrastructure/fly/api.toml`
5. Repeat for worker with `infrastructure/fly/worker.toml`

## Deploy sequence

Always in this order:

```bash
# 1. Migration safety check
pnpm ops:check-migrations

# 2. Apply migrations to target DB (DATABASE_URL must point at target)
pnpm ops:migrate-deploy

# 3. Deploy API + worker + web (platform-specific)

# 4. Smoke test
curl https://<api>/health
curl https://<api>/health/db
curl https://<api>/api/v1/ping

# 5. Ops status (with token in production)
curl -H "Authorization: Bearer $OPS_TOKEN" https://<api>/api/v1/system/ops-status
```

## Kill switch (23.3)

When the AI receptionist misbehaves, **flip the env var** — no git redeploy required:

```bash
AI_RECEPTIONIST_ENABLED=false
```

Effect: all inbound SMS escalates to stylist immediately (`kill_switch` reason).

### Platform examples

**Fly.io**

```bash
fly secrets set AI_RECEPTIONIST_ENABLED=false -a project-braids-api-staging
fly machines restart -a project-braids-api-staging
```

**Restore**

```bash
fly secrets set AI_RECEPTIONIST_ENABLED=true -a project-braids-api-staging
fly machines restart -a project-braids-api-staging
```

### Drill (required before production)

```bash
API_URL=https://api-staging.example.com OPS_TOKEN=<token> pnpm ops:kill-switch-drill
```

Complete the checklist printed by the script. Record the date in your runbook.

### Verify via API

`GET /api/v1/system/ops-status` returns:

- `aiReceptionistEnabled` — current flag
- `killSwitchActive` — `true` when AI is disabled
- `gitSha`, `version`, `environment`

Protected by `OPS_BEARER_TOKEN` when set (recommended in staging/production).

## Rollback (23.3)

```bash
pnpm ops:rollback   # prints procedure
```

**Fastest:** kill switch (`AI_RECEPTIONIST_ENABLED=false`).

**Application:** redeploy previous Docker image or Vercel deployment.

**Database:** forward-only — never `migrate reset` in production. See [MIGRATIONS.md](./MIGRATIONS.md).

## Health endpoints

| Path                            | Use                                     |
| ------------------------------- | --------------------------------------- |
| `GET /health`                   | Load balancer liveness                  |
| `GET /health/db`                | Postgres connectivity                   |
| `GET /api/v1/system/ops-status` | Deploy verification + kill switch state |

## Scripts

| Command                      | Script                          |
| ---------------------------- | ------------------------------- |
| `pnpm ops:check-migrations`  | Destructive SQL scan            |
| `pnpm ops:migrate-deploy`    | Check + `prisma migrate deploy` |
| `pnpm ops:kill-switch-drill` | Kill switch verification        |
| `pnpm ops:rollback`          | Rollback runbook                |
| `pnpm ops:smoke-staging`     | Post-deploy API smoke test      |

**First-time staging:** follow [STAGING_SETUP.md](./STAGING_SETUP.md) end to end.

## Production readiness (M7 beta)

Before onboarding pilot stylists:

- [ ] Staging fully isolated and smoke-tested
- [ ] Kill-switch drill completed on staging
- [ ] Rollback drill timed once
- [ ] `OPS_BEARER_TOKEN` set on production API
- [ ] Sentry DSN configured
- [ ] Stripe webhooks pointed at production `/api/v1/webhooks/stripe`
- [ ] Twilio SMS webhook at `/api/v1/webhooks/twilio/sms`

See Back Matter §8 Production Readiness Checklist for the full list.
