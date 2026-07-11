# Webhook Conventions — Project Braids

**Chapter:** 2.6  
**Last updated:** 2026-07-11

## Scope

All inbound third-party webhooks (Stripe, Twilio, future Meta/WhatsApp) must follow this sequence. Feature-specific handlers (Ch.9 Stripe, Ch.11 Twilio) use the shared utility — they do not reimplement deduplication.

## Shared idempotency ledger

Table: `processed_webhook_events` (cross-cutting — **not owned by a single feature module**).

| Column         | Purpose                           |
| -------------- | --------------------------------- |
| `event_id`     | Provider's unique event id (PK)   |
| `source`       | `stripe` \| `twilio` \| `example` |
| `processed_at` | When processing completed         |

Documented in [ARCHITECTURE.md](../ARCHITECTURE.md) § Cross-cutting infrastructure.

## Required four-step sequence

```
1. VERIFY signature     → reject 401/403 if invalid; do not parse untrusted body
2. DEDUPE               → if event_id already in processed_webhook_events, return 200, stop
3. PROCESS              → run business logic (prefer transaction)
4. RECORD               → insert event_id only after success
```

### Why this order?

| Step              | Rationale                                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| **Verify first**  | Prevents attackers from probing which `event_id` values exist in the dedupe table using unsigned payloads |
| **Dedupe second** | Safe only after authenticity is proven                                                                    |
| **Process third** | Business logic runs at most once per authentic event                                                      |
| **Record last**   | If the process crashes mid-handler, the provider retry re-enters at step 3 — not falsely marked "done"    |

## Authentication exceptions

| Rule                                           | Detail                                     |
| ---------------------------------------------- | ------------------------------------------ |
| Webhooks **skip** user JWT/session middleware  | Caller is a third-party provider           |
| Webhooks **never skip** signature verification | Stripe-Signature, X-Twilio-Signature, etc. |

## Shared utility

`apps/api/src/lib/webhooks/idempotent-handler.ts`:

```typescript
await processWebhookIdempotently({
  eventId: providerEventId,
  source: 'stripe',
  handler: async () => {
    /* business logic */
  },
});
```

Callers must verify signatures **before** invoking this helper.

## Provider retry behaviour

Return **200** for:

- Successfully processed events
- Duplicate events (already in ledger)

Return **4xx** only for malformed or unsigned payloads. Providers retry on non-2xx — handlers must never double-apply side effects.

## Tests

`idempotent-handler.test.ts` proves duplicate `event_id` skips the handler callback.

## Adding a new webhook

1. Add route under `/api/v1/webhooks/<provider>/`
2. Verify signature in the route (provider-specific)
3. Wrap handler with `processWebhookIdempotently`
4. Add `source` enum value if new provider
5. Document provider-specific quirks in the owning module README (e.g. `modules/payments/`)

Do **not** build Stripe/Twilio business logic in this shared layer — Ch.9 and Ch.11 own that.
