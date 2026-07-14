# Live Stripe setup — private beta (3–4 stylists)

Use this guide to accept **real card deposits** from clients and route funds to stylists via **Stripe Connect** (destination charges).

## Overview

| Layer                | What you need                                                                   |
| -------------------- | ------------------------------------------------------------------------------- |
| **Stripe Dashboard** | Connect enabled, live API keys, webhook endpoint                                |
| **API** (`apps/api`) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Connect return URLs               |
| **Web** (`apps/web`) | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (must match secret key mode: test vs live) |

The codebase uses **Stripe Connect Express** (UK) via the **Accounts V2 API** (`recipient` configuration for destination-charge deposits). Deposits are **PaymentIntents** with `transfer_data.destination` → stylist’s connected account.

## 1. Stripe Dashboard (one-time)

1. Create or open your [Stripe account](https://dashboard.stripe.com).
2. **Connect** → Settings → enable **Express** accounts for your platform.
3. **Required:** Complete your [Connect platform profile](https://dashboard.stripe.com/settings/connect/platform-profile) — including **loss responsibilities** for connected accounts. Without this, account creation fails with “Please review the responsibilities of managing losses…”.
4. For beta, start in **Test mode**; switch to **Live** when ready for real money.

### API keys

| Mode | Secret (API `.env`) | Publishable (Web `.env`) |
| ---- | ------------------- | ------------------------ |
| Test | `sk_test_…`         | `pk_test_…`              |
| Live | `sk_live_…`         | `pk_live_…`              |

**Never** mix test secret with live publishable (or vice versa).

## 2. Environment variables

### API (root `.env` or host secrets)

```bash
STRIPE_SECRET_KEY=sk_live_...          # or sk_test_ for dry run
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_RETURN_URL=https://your-app.com/stylist/payments
STRIPE_CONNECT_REFRESH_URL=https://your-app.com/stylist/payments
API_PUBLIC_URL=https://api.your-app.com
WEB_APP_URL=https://your-app.com
```

When `STRIPE_SECRET_KEY` is set, the API uses **live Stripe** (not mock). Mock simulate endpoint is disabled in `NODE_ENV=production`.

### Web (Vercel / `.env`)

```bash
NEXT_PUBLIC_API_URL=https://api.your-app.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

Without the publishable key, clients only see “Continue to payment” with no card form.

## 3. Webhook endpoint

Stripe must notify your API when a payment succeeds.

**URL:** `https://<api-host>/api/v1/webhooks/stripe`

**Events to subscribe (minimum):**

- `payment_intent.succeeded` — confirms booking after deposit
- `payment_intent.payment_failed`
- `account.updated` — syncs Connect onboarding status
- `charge.dispute.created` (optional but recommended)

### Local testing with Stripe CLI

```bash
stripe listen --forward-to localhost:3001/api/v1/webhooks/stripe
# Copy the whsec_... signing secret into STRIPE_WEBHOOK_SECRET
```

### Production

Create the endpoint in Stripe Dashboard → Developers → Webhooks. Use the endpoint’s **signing secret** as `STRIPE_WEBHOOK_SECRET`.

## 4. Onboard each stylist

Each pilot stylist must complete Connect before deposits work (`isPaymentReady` gate).

1. Stylist logs in → bottom nav **Pay** (requires `can_view_payouts` or owner).
2. Tap **Connect with Stripe** → complete Stripe Express onboarding (identity + bank).
3. Status should show **Charges enabled** and **Onboarding complete**.
4. `account.updated` webhook (or refresh on Pay page) syncs status to `payment_accounts`.

Owners see the Pay tab by default; staff need `can_view_payouts`.

## 5. Client deposit flow

1. Client books (SMS AI, `/book` link, or dashboard).
2. Booking is **held** with a deposit amount from stylist policy.
3. Client opens `/client/bookings/{id}` (also linked from SMS).
4. **Continue to payment** → Stripe Payment Element → card charge.
5. `payment_intent.succeeded` webhook → booking **confirmed**, deposit **captured**. If webhooks are not forwarded (common locally), the web app also calls `POST /payments/deposits/:bookingId/sync` immediately after Stripe.js confirms payment.

## 6. Beta checklist

- [ ] API deployed with live/test Stripe keys (consistent mode)
- [ ] Web deployed with matching `pk_` key
- [ ] Webhook receiving events (check Stripe Dashboard → Webhooks → recent deliveries)
- [ ] One test booking end-to-end: hold → pay → confirmed
- [ ] Stylist sees payout/income on **Pay** page after capture
- [ ] `STRIPE_CONNECT_RETURN_URL` uses your real web URL (not localhost) in production

## 7. Test cards (Stripe test mode only)

| Card                                        | Result  |
| ------------------------------------------- | ------- |
| `4242 4242 4242 4242`                       | Success |
| Any future expiry, any CVC, any UK postcode |

## Troubleshooting

| Symptom                                                    | Likely cause                                                                                                                                                      |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Stylist has not completed Stripe Connect”                 | Connect onboarding incomplete or `chargesEnabled` false                                                                                                           |
| Payment succeeds but booking stays held                    | Webhook not reaching API — web sync should still confirm; restart API/web after env changes. For webhook-only paths, check `STRIPE_WEBHOOK_SECRET` and Stripe CLI |
| “Card was declined” in local dev                           | App is in **Stripe test mode** — real cards are rejected. Use test card `4242 4242 4242 4242` (any future expiry/CVC)                                             |
| Connect button spins then times out                        | Usually fixed in API — ensure `rejectImpersonationOnSensitiveRoutes` pre-handler is `async`; restart `pnpm dev` if an old API process is stuck                    |
| “Please review the responsibilities… losses”               | [Connect platform profile](https://dashboard.stripe.com/settings/connect/platform-profile) incomplete — finish setup in Stripe Dashboard                          |
| “localhost is only allowed in testmode” / live + localhost | Use **test** keys (`sk_test_`/`pk_test_`) for local dev, or set Connect return URLs to **HTTPS** (deployed app or ngrok) when using live keys                     |

## Related docs

- [PAYMENTS.md](./PAYMENTS.md) — Chapter 9 architecture
- [PAYMENTS_INTEGRATION.md](./PAYMENTS_INTEGRATION.md) — booking ↔ payments contracts
- [DEPLOYMENT.md](./DEPLOYMENT.md) — hosting API + web
