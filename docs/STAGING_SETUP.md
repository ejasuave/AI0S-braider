# Staging setup — pilot prep (M7)

Step-by-step guide to deploy **Project Braids** to an isolated staging environment before onboarding pilot stylists.

**Time:** ~2–4 hours first time (mostly waiting on DNS + platform dashboards).

**You will need accounts on:** Supabase, Upstash, Fly.io (API + worker), Vercel (web), Stripe (test mode), Twilio, Google Cloud, Anthropic.

---

## 0. Pick your staging URLs

Choose stable hostnames before creating OAuth clients or webhooks. Example:

| Service      | Example URL                                  |
| ------------ | -------------------------------------------- |
| Web (Vercel) | `https://project-braids-staging.vercel.app`  |
| API (Fly.io) | `https://project-braids-api-staging.fly.dev` |

Write yours down — every dashboard below uses them.

---

## 1. Supabase (Postgres + Storage)

1. [supabase.com](https://supabase.com) → **New project** (name e.g. `project-braids-staging`, region **London**).
2. **Project Settings → Database → Connection string → URI** (direct, port **5432**, not pooler).
3. Save as `DATABASE_URL` for staging migrations and Fly secrets.
4. **Storage** — create buckets if your stylist portfolio flow needs them (same project as local dev uses via `StorageProvider`).

Apply schema:

```bash
# From repo root — DATABASE_URL must point at staging Supabase
cp .env.staging.example .env.staging   # or: bash scripts/setup-staging-env.sh
# Edit .env.staging — set DATABASE_URL and other placeholders

export $(grep -v '^#' .env.staging | xargs)   # or source manually
pnpm ops:migrate-deploy
pnpm db:seed   # optional — style categories for /book dropdown
```

---

## 2. Upstash (Redis)

1. [console.upstash.com](https://console.upstash.com) → **Create database** (region close to Fly `lhr`).
2. Copy the **Redis URL** (`rediss://…`) → `REDIS_URL` in `.env.staging`.

Required for BullMQ (notifications, hold expiry, calendar reconcile).

---

## 3. Generate staging secrets file

```bash
bash scripts/setup-staging-env.sh
```

This creates `.env.staging` from `.env.staging.example` and generates:

- `JWT_SECRET`
- `OPS_BEARER_TOKEN`
- `GOOGLE_CALENDAR_WEBHOOK_SECRET`

**Edit `.env.staging`** and fill in every `…` placeholder:

| Variable                                    | Where to get it                                                                           |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `DATABASE_URL`                              | Supabase (step 1)                                                                         |
| `REDIS_URL`                                 | Upstash (step 2)                                                                          |
| `CORS_ORIGIN` / `WEB_APP_URL`               | Your Vercel web URL                                                                       |
| `API_PUBLIC_URL`                            | Your Fly API URL                                                                          |
| `STRIPE_*`                                  | Stripe Dashboard **Test mode**                                                            |
| `TWILIO_*`                                  | Twilio Console                                                                            |
| `RESEND_API_KEY` / `EMAIL_FROM`             | Resend (required for staff invite emails)                                                 |
| `OTP_DELIVERY`                              | Optional. Default on staging: on-screen OTP (`console`). Set `sms` to restore Twilio OTP. |
| `ANTHROPIC_API_KEY`                         | console.anthropic.com                                                                     |
| `AI_PROVIDER` / `OPENAI_COMPAT_*`           | Optional Groq override (see below)                                                        |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Cloud (step 6)                                                                     |
| `SENTRY_DSN`                                | sentry.io (optional but recommended)                                                      |

**Founder staging override (Anthropic out of credits):** create a free key at [console.groq.com](https://console.groq.com), then:

```bash
fly secrets set \
  AI_PROVIDER=openai_compatible \
  OPENAI_COMPAT_API_KEY=gsk_... \
  OPENAI_COMPAT_BASE_URL=https://api.groq.com/openai/v1 \
  OPENAI_COMPAT_MODEL=llama-3.3-70b-versatile \
  -a project-braids-api-staging
```

Production target remains Anthropic Claude (`AI_PROVIDER=anthropic`).

**Web-only vars** (set in Vercel, not Fly):

- `NEXT_PUBLIC_API_URL` → Fly API URL
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_test_…` (same mode as `STRIPE_SECRET_KEY`)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` → same as `GOOGLE_CLIENT_ID`

---

## 4. Fly.io — API

```bash
# Install: https://fly.io/docs/hands-on/install-flyctl/
fly auth login

fly apps create project-braids-api-staging
# If name taken, pick another and update fly.api.staging.toml → app = "..."

# Import secrets (never commit .env.staging)
fly secrets import --stage < .env.staging -a project-braids-api-staging

# Deploy from repo root (build context must be monorepo root)
fly deploy --config fly.api.staging.toml -a project-braids-api-staging
```

After deploy, note the HTTPS URL (e.g. `https://project-braids-api-staging.fly.dev`). Update:

- `.env.staging` → `API_PUBLIC_URL`
- Vercel → `NEXT_PUBLIC_API_URL`
- Re-import Fly secrets if you changed `API_PUBLIC_URL`

Verify:

```bash
curl https://<api-host>/health
curl https://<api-host>/health/db
```

---

## 5. Fly.io — Worker

```bash
fly apps create project-braids-worker-staging

fly secrets import --stage < .env.staging -a project-braids-worker-staging

fly deploy --config fly.worker.staging.toml -a project-braids-worker-staging
```

The worker has no public URL — it consumes Redis queues only.

---

## 6. Vercel — Web

1. [vercel.com](https://vercel.com) → **Add New → Project** → import this Git repo.
2. **Root Directory:** `apps/web`
3. **Framework:** Next.js
4. **Build & Development Settings:**
   - **Install Command:** `cd ../.. && pnpm install`
   - **Build Command:** `cd ../.. && pnpm exec turbo run build --filter=@project-braids/web`
5. **Environment variables** (Production + Preview for staging branch):

   ```
   NEXT_PUBLIC_API_URL=https://<your-fly-api-host>
   NEXT_PUBLIC_PLATFORM_DISPLAY_NAME=Project Braids (Staging)
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
   NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same as GOOGLE_CLIENT_ID>
   ```

   **Do not use `pk_live_` on staging.** Publishable and secret keys must be the same mode
   (`pk_test_` + Fly `sk_test_`). A live publishable key does **not** enable real stylist payouts
   safely — it mismatches the test API and/or risks charging real cards. Live money only after a
   deliberate cutover ([STRIPE_LIVE_SETUP.md](./STRIPE_LIVE_SETUP.md)).
   `parseWebEnv` **ignores** `pk_live_` on staging surfaces (Stripe.js stays off until you set `pk_test_`).

6. Deploy. Open the Vercel URL → confirm login page loads.

Confirm Stripe test mode on both sides:

```bash
WEB_URL=https://<vercel-host> \
API_URL=https://<fly-api-host> \
OPS_TOKEN=<ops> \
pnpm ops:check-stripe-staging
```

Update Fly secrets with the final web URL:

```bash
# CORS_ORIGIN and WEB_APP_URL must match Vercel exactly (no trailing slash)
fly secrets set CORS_ORIGIN=https://<vercel-host> WEB_APP_URL=https://<vercel-host> \
  -a project-braids-api-staging
fly machines restart -a project-braids-api-staging
```

---

## 7. Stripe webhooks (test mode)

1. [Stripe Dashboard](https://dashboard.stripe.com) → ensure **Test mode** is on.
2. **Developers → Webhooks → Add endpoint**
   - URL: `https://<api-host>/api/v1/webhooks/stripe`
   - Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`, `charge.dispute.created`
3. Copy **Signing secret** → `STRIPE_WEBHOOK_SECRET` in Fly secrets + `.env.staging`.
4. Update Connect return URLs in secrets:

   ```
   STRIPE_CONNECT_RETURN_URL=https://<vercel-host>/stylist/payments
   STRIPE_CONNECT_REFRESH_URL=https://<vercel-host>/stylist/payments
   ```

See [STRIPE_LIVE_SETUP.md](./STRIPE_LIVE_SETUP.md) for the full deposit flow.

---

## 8. Twilio SMS webhooks

1. [Twilio Console](https://console.twilio.com) → buy or use a UK SMS-capable number.
2. **Phone number → Configure → Messaging:**
   - **A message comes in:** Webhook, `POST`, `https://<api-host>/api/v1/webhooks/twilio/sms`
   - **Status callback URL:** `https://<api-host>/api/v1/webhooks/twilio/sms/status`
3. Set in Fly secrets:

   ```
   TWILIO_ACCOUNT_SID=AC...
   TWILIO_AUTH_TOKEN=...
   TWILIO_PHONE_NUMBER=+447...
   ```

Send a test SMS to the number — check Fly logs for inbound webhook.

---

## 9. Google Calendar OAuth (staging)

In [Google Cloud Console](https://console.cloud.google.com/) (project **Project braids** / `suaviizoffical@gmail.com`):

1. **APIs & Services → Credentials** → your OAuth Web client.
2. **Authorized JavaScript origins:** `https://<vercel-host>`
3. **Authorized redirect URIs:** `https://<vercel-host>/stylist/calendar`
4. Keep `http://localhost:3000/stylist/calendar` for local dev.

**Test users (while app is in Testing):** add each pilot stylist Gmail under **OAuth consent screen → Test users**.

Set on Fly + Vercel:

```
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_CALENDAR_WEBHOOK_SECRET=<from setup-staging-env.sh>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<same client id on Vercel>
```

Outbound calendar sync works on staging; inbound push webhooks need a public `API_PUBLIC_URL` (Fly provides this).

---

## 10. Smoke test + ops drills

```bash
# Replace with your API host and OPS token from .env.staging
export API_URL=https://<api-host>
export OPS_TOKEN=<ops-bearer-token-from-env-staging>

pnpm ops:smoke-staging
pnpm ops:kill-switch-drill
```

**Kill-switch drill (complete once per environment):**

```bash
fly secrets set AI_RECEPTIONIST_ENABLED=false -a project-braids-api-staging
fly machines restart -a project-braids-api-staging
pnpm ops:kill-switch-drill   # expect killSwitchActive: true

# Send test SMS — should escalate, not auto-reply

fly secrets set AI_RECEPTIONIST_ENABLED=true -a project-braids-api-staging
fly machines restart -a project-braids-api-staging
pnpm ops:kill-switch-drill   # expect killSwitchActive: false
```

**Rollback drill:** read `pnpm ops:rollback` once; time how long a Vercel redeploy + Fly image rollback would take.

---

## 11. Pilot #1 end-to-end checklist

On staging URLs (not localhost):

- [ ] Stylist signup + email login
- [ ] Profile, services, hours, policy filled in
- [ ] **Team** → invite staff by email → accept via `/invite/{token}` → phone OTP on `/login/team` (not client sign-in) → staff lands on `/stylist`
- [ ] Returning staff: `/login` → **Team member phone sign in** → OTP → `/stylist` (no email password)
- [ ] **Pay** → Stripe Connect onboarding (test mode)
- [ ] **Calendar** → Connect Google Calendar
- [ ] Copy booking link → client books → test card `4242 4242 4242 4242` → booking **confirmed**
- [ ] Event appears in Google Calendar
- [ ] SMS to Twilio number → AI replies or escalates
- [ ] Stylist inbox shows conversation

---

## Troubleshooting

| Symptom                                        | Fix                                                                                                                                          |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| CORS error in browser                          | `CORS_ORIGIN` on API must exactly match Vercel URL                                                                                           |
| Stripe `pk_live_` on staging / payments broken | Vercel → set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_…` from `.env.staging` → **Redeploy**. Confirm with `pnpm ops:check-stripe-staging` |
| Stripe webhook 4xx                             | Check `STRIPE_WEBHOOK_SECRET`; URL must be HTTPS; use **Test mode** endpoint secret                                                          |
| Google `redirect_uri_mismatch`                 | Redirect URI must exactly match Vercel `/stylist/calendar`                                                                                   |
| Google `access_denied` (403)                   | Add stylist email as OAuth **test user**                                                                                                     |
| Calendar mock mode on staging                  | `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` missing on Fly                                                                                   |
| Deposits blocked                               | Stylist must finish Stripe Connect (`isPaymentReady`)                                                                                        |
| SMS not received                               | Twilio webhook URL + UK number; check Fly logs                                                                                               |

---

## Related docs

- [DEPLOYMENT.md](./DEPLOYMENT.md) — architecture + CI/CD
- [STRIPE_LIVE_SETUP.md](./STRIPE_LIVE_SETUP.md) — Connect + webhooks
- [GOOGLE_CALENDAR_SETUP.md](./GOOGLE_CALENDAR_SETUP.md) — local + OAuth details
- [MESSAGING.md](./MESSAGING.md) — Twilio webhook paths
