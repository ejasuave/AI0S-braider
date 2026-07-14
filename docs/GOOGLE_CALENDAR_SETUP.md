# Google Calendar setup (local dev)

One-time setup so confirmed bookings appear in your real Google Calendar.

## 1. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/)
2. Create or select a project
3. **APIs & Services → Library** → enable **Google Calendar API**
4. **APIs & Services → OAuth consent screen**
   - User type: **External** (add yourself as a test user while in Testing)
   - Scopes: add `https://www.googleapis.com/auth/calendar.events`
5. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**
   - Authorized redirect URIs:
     - `http://localhost:3000/stylist/calendar`
   - Copy **Client ID** and **Client secret**

## 2. Repo `.env`

Add to the repo root `.env` (same file as Stripe keys):

```bash
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CALENDAR_WEBHOOK_SECRET=<already set by setup script>
API_PUBLIC_URL=http://localhost:3001
```

`NEXT_PUBLIC_GOOGLE_CLIENT_ID` must match `GOOGLE_CLIENT_ID`.

## 3. Restart and reconnect

```bash
pnpm dev
```

1. Stylist app → **More → Calendar**
2. If connected in **dev mock** mode, **Disconnect**
3. **Connect Google Calendar** → sign in with Google → allow calendar access
4. Confirm a booking — check Google Calendar for the event

## Localhost limits

Google **push webhooks** need a public HTTPS URL. On localhost:

- **Outbound sync works** (confirmed bookings → Google Calendar)
- **Inbound** (Google → app) uses the 30-minute reconcile job, not instant webhooks

For instant inbound sync locally, expose the API with ngrok and set `API_PUBLIC_URL` to the ngrok HTTPS URL.

## Verify API mode

On API startup, logs should show `stripeMode` and Google Calendar should **not** show mock mode on `/stylist/calendar` (badge: **Connected**, not **Connected (dev mock)**).

Run: `bash scripts/check-google-calendar-env.sh`
