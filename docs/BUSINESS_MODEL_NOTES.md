# Business model notes (Chapter 9)

## Flat subscription — no platform take-rate on deposits

Chapter 9 payout logic assumes the **current flat-subscription business model**: captured client deposits flow to the stylist's Stripe Connect balance via **destination charges** (`transfer_data.destination` on PaymentIntents). The platform does not deduct a commission at capture time.

Stripe Connect's built-in payout schedule moves funds from the connected account balance to the stylist's bank. We do **not** maintain a separate platform-side payout ledger — payout history is queried live from Stripe (`GET /businesses/me/payouts`).

## If a take-rate is introduced later (Chapter 25)

Revisit:

1. **PaymentIntent charge type** — may need `application_fee_amount` on platform charges instead of pure destination transfers.
2. **`GET /businesses/me/income-report`** — would need a platform-fee line item.
3. **Payout timing** — custom hold/disburse logic may be required if the platform must retain a fee before paying the stylist.

Document any founder decision here before implementing commission logic.
