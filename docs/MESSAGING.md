# Messaging (Chapter 11)

Channel-agnostic conversation substrate. **Founder override (2026-07):** authenticated **in-app web chat** is the primary client ↔ AI receptionist channel. Twilio SMS ingress remains supported (webhook + booking numbers) but is not the primary product UI. Anonymous embeddable web widget and WhatsApp remain V2.

## Module ownership

| Owns                                                         | Does not own                                     |
| ------------------------------------------------------------ | ------------------------------------------------ |
| `conversations`, `messages`, `escalations` schema            | AI message content / intent (Ch.13 receptionist) |
| `sendMessage` / `receiveMessage` write paths                 | Notification scheduling (Ch.12)                  |
| Twilio SMS ingress/egress + delivery status                  | Payment capture (Ch.9)                           |
| In-app client web chat (authenticated)                       | Anonymous embeddable widget (V2)                 |
| `escalateConversation` / `isEscalated` / `resolveEscalation` |                                                  |

**Tenant key:** `stylistId` on `conversations` (maps to prompt library `business_id`).

## Public service contracts (preserve for Ch.13)

```typescript
messagingService.sendMessage({ conversationId, sender, content, ... })
messagingService.receiveMessage({ stylistId, clientId, channel, content, ... })
messagingService.isEscalated(conversationId)
messagingService.escalateConversation(stylistId, conversationId, reason)
messagingService.resolveEscalation(stylistId, conversationId, resolvedById)
```

## API routes

| Method | Path                                                     | Auth       | Purpose                             |
| ------ | -------------------------------------------------------- | ---------- | ----------------------------------- |
| GET    | `/api/v1/messaging/conversations`                        | stylist    | Paginated inbox (`limit`, `offset`) |
| GET    | `/api/v1/messaging/conversations/:id`                    | stylist    | Thread detail                       |
| GET    | `/api/v1/messaging/client/conversations`                 | client     | Own threads only                    |
| POST   | `/api/v1/messaging/client/conversations`                 | client     | Start/resume `channel: web` thread  |
| GET    | `/api/v1/messaging/client/conversations/:id`             | client     | Own thread detail                   |
| POST   | `/api/v1/messaging/client/conversations/:id/messages`    | client     | In-app client message + AI turn     |
| POST   | `/api/v1/messaging/conversations/:id/messages`           | stylist    | Reply while escalated               |
| POST   | `/api/v1/messaging/conversations/:id/escalate`           | stylist    | Handoff to human                    |
| POST   | `/api/v1/messaging/conversations/:id/resolve-escalation` | stylist    | Return to AI                        |
| POST   | `/api/v1/webhooks/twilio/sms`                            | Twilio sig | Inbound SMS                         |
| POST   | `/api/v1/webhooks/twilio/sms/status`                     | Twilio     | Delivery callbacks                  |

## In-app web chat (primary)

1. Client `POST /messaging/client/conversations` with `{ stylistId }` → open `channel: 'web'` conversation.
2. Client `POST .../messages` with `{ content }` → `receiveMessage` then `receptionistService.processInboundTurn`.
3. Provider: Anthropic by default; **staging founder override** may use Groq via `AI_PROVIDER=openai_compatible` when Anthropic has no credits.
4. AI / stylist / system replies use `sendOutboundMessage`, which **does not** send Twilio SMS when `channel !== 'sms'`.

## SMS trust model (Prompt 11.2)

Receiving an inbound SMS creates or reuses a **lightweight client** via `findOrCreateClientByPhone`. This is **not** equivalent to OTP verification:

- **Conversational replies** may proceed without OTP.
- **Deposit charges** (Ch.9) still require verified client identity before payment.

STOP/START keywords delegate to `clientPreferencesService.handleStopKeyword` / `handleStartKeyword` (Ch.5.4), which halts AI auto-replies and marketing while allowing transactional SMS and reminders per Blueprint — see [COMPLIANCE.md](COMPLIANCE.md).

## Escalation notifications (Prompt 11.5)

`escalateConversation` sends an SMS to the stylist owner's phone (not only a silent DB flag) plus a system message to the client.

## Delivery status (Prompt 11.2)

Outbound SMS messages store `delivery_status` (`pending` → `sent` → `delivered` / `failed` / `undelivered`). Configure Twilio status callback URL:

`{API_PUBLIC_URL}/api/v1/webhooks/twilio/sms/status`

## Deferred V2 (Prompts 11.3–11.4)

| Prompt          | Status | Notes                                                      |
| --------------- | ------ | ---------------------------------------------------------- |
| 11.3 WhatsApp   | V2     | Requires Meta WhatsApp Business API provisioned externally |
| 11.4 Web widget | V2     | Anonymous/embeddable widget on public pages (SSE)          |

Authenticated in-app web chat (above) is **not** the V2 widget.

See `apps/api/src/modules/messaging/README.md` for implementation file map.
