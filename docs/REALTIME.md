# Real-time updates (Chapter 17.5)

## Choice: Server-Sent Events (SSE)

The stylist dashboard uses **SSE** rather than WebSockets:

- Push is **server → client only** (new bookings, escalations, messages).
- Client actions already use REST (`POST` replies, approve booking, etc.) per API-first conventions.
- SSE works through standard HTTP with `Authorization: Bearer` headers (browser `EventSource` cannot set custom headers, so the web app uses `fetch` + `ReadableStream`).

## Backend

| Piece         | Location                                  |
| ------------- | ----------------------------------------- |
| SSE route     | `GET /api/v1/realtime/stylist/events`     |
| Hub           | `apps/api/src/modules/realtime/hub.ts`    |
| Domain bridge | `apps/api/src/modules/realtime/events.ts` |

The hub subscribes to existing domain events (`onBookingCreated`, `onConversationEscalated`, `onConversationMessage`) — modules do not call the hub directly.

**MVP limitation:** in-process fan-out per API instance. Multi-instance deploys need Redis/pub-sub (future).

### Event types

| Event                    | Payload                         | Trigger                       |
| ------------------------ | ------------------------------- | ----------------------------- |
| `booking_created`        | `{ bookingId, status }`         | New booking saved             |
| `conversation_escalated` | `{ conversationId, reason }`    | Thread escalated to stylist   |
| `conversation_message`   | `{ conversationId, messageId }` | New message in a conversation |

## Frontend

| Piece         | Location                                                                  |
| ------------- | ------------------------------------------------------------------------- |
| Hook          | `apps/web/src/shared/lib/use-sse.ts` — `useStylistRealtime`               |
| Layout bridge | `apps/web/src/app/stylist/layout.tsx` — invalidates TanStack Query caches |

### Reconnection

On disconnect, the hook reconnects with exponential backoff (cap 30s). After a successful reconnect (`attempt > 0`), `onReconnect` runs a **one-time refetch** of bookings and messaging queries so events missed while offline are reconciled.

Open conversation detail (`/stylist/inbox/[id]`) also subscribes to invalidate that thread when a matching `conversation_message` arrives.

## Testing

- `apps/api/src/modules/realtime/hub.test.ts` — publish/subscribe
- Frontend reconciliation is covered by `use-sse` integration expectations in Ch.17 success criteria (manual + future E2E)
