# Messaging module

Owns conversation persistence, stylist handoff (Ch.11), authenticated in-app web chat, and SMS ingress/egress. See [docs/MESSAGING.md](../../../docs/MESSAGING.md) for full chapter alignment.

## Tables

- `conversations` — stylist + client thread per channel (`active` | `escalated` | `resolved` | `abandoned`)
- `messages` — client, AI, stylist, and system messages; optional `delivery_status` for outbound SMS
- `escalations` — human takeover records (Ch.11.5)
- `stylist_profiles.sms_booking_number` — dedicated inbound SMS number per stylist

## Service contracts (Ch.11.1 / 11.5)

- `sendMessage()` — single outbound write path (alias: `sendOutboundMessage`)
- `receiveMessage()` — single inbound client write path with conversation resolution
- `isEscalated(conversationId)` — handoff check for Ch.13 receptionist
- `escalateConversation()` — status + stylist SMS notification + client system message
- `resolveEscalation()` — return thread to `active`
- `startClientWebConversation()` / `receiveClientWebMessage()` — authenticated in-app chat

## Routes

| Method | Path                                                     | Auth             | Purpose                        |
| ------ | -------------------------------------------------------- | ---------------- | ------------------------------ |
| GET    | `/api/v1/messaging/booking-number`                       | stylist          | Read assigned SMS number       |
| PUT    | `/api/v1/messaging/booking-number`                       | stylist          | Assign SMS booking number      |
| GET    | `/api/v1/messaging/conversations`                        | stylist          | Paginated inbox list           |
| GET    | `/api/v1/messaging/conversations/:id`                    | stylist          | Thread detail                  |
| GET    | `/api/v1/messaging/client/conversations`                 | client           | Client's own threads           |
| POST   | `/api/v1/messaging/client/conversations`                 | client           | Start/resume web chat          |
| GET    | `/api/v1/messaging/client/conversations/:id`             | client           | Client thread detail           |
| POST   | `/api/v1/messaging/client/conversations/:id/messages`    | client           | Client in-app message + AI     |
| POST   | `/api/v1/messaging/conversations/:id/escalate`           | stylist          | Escalate to human              |
| POST   | `/api/v1/messaging/conversations/:id/messages`           | stylist          | Stylist reply (escalated only) |
| POST   | `/api/v1/messaging/conversations/:id/resolve-escalation` | stylist          | Return thread to AI            |
| POST   | `/api/v1/webhooks/twilio/sms`                            | Twilio signature | Inbound SMS webhook            |
| POST   | `/api/v1/webhooks/twilio/sms/status`                     | Twilio           | Outbound delivery status       |
| POST   | `/api/v1/messaging/dev/inbound-sms`                      | none (dev only)  | Simulate inbound SMS           |

## Providers

- **Console** (default local) — logs to terminal; OTP dev helper unchanged
- **Twilio** — when `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_PHONE_NUMBER` are set (SMS channel only)

## SMS vs OTP (Prompt 11.2)

Inbound SMS creates a lightweight client record for conversation. **Deposit payment still requires OTP-verified identity** — receiving SMS alone is not proof of ownership for charging.

## V2 channels

- **WhatsApp (11.3)** — not implemented; schema supports `channel: whatsapp`
- **Anonymous web widget (11.4)** — not implemented; authenticated in-app `channel: web` chat is live

Does not own AI receptionist logic (Ch.13) or notification scheduling (Ch.12).
