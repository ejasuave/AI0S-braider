# Receptionist module

Owns AI receptionist orchestration (Ch.13): structured-output turns, escalation policy, and booking dispatch.

## Responsibilities

- `handleInboundMessage` / `processInboundTurn` — orchestration entry after Ch.11 `receiveMessage`
- Load bounded conversation history + stylist context (timezone, offerings, policies, working hours)
- Build deterministic **session memory** (client name, style/size/length, quoted price/duration, add-ons, booking status, clarification streak, idle gap)
- Call the configured AI provider (Anthropic Claude, or staging OpenAI-compatible/Groq) for structured JSON output
- Validate output, retry once on schema failure, then escalate with `structured_output_validation_failed`
- Transport/billing failures escalate with `ai_provider_unavailable` (no schema retry)
- Merge multi-turn `extracted_slots` in application code (style/size/length changes invalidate stale quotes)
- Keep FAQ / policy / location / payment topic switches on the model reply (do not force booking copy over them)
- Enforce consolidated `shouldEscalate()` at 0.8 threshold + injection, frustration, human-request, and repeated-clarification detection
- Dispatch actions: clarify, price lookup, propose slots (max 3), create hold, deposit link
- Re-offer slots on `SLOT_UNAVAILABLE` race (Ch.13.5)
- Record `model_confidence` / `model_next_action` on escalation rows

## Conversation memory

The model is **stateless**. Memory is application-owned:

1. Persisted `messages` transcript (also recovers chat after page refresh via `conversationId`)
2. Merged `extracted_slots` across AI turns (`clientName`, `addonNames`, `quotedPrice`, `quotedDurationMinutes`, `bookingStatus`, plus classic booking slots)
3. `sessionMemory` summary injected into the system prompt each turn

`conversations.status = abandoned` exists in schema for future idle cleanup; there is **no abandoned cron** in MVP. Idle gaps ≥30 minutes are noted in session memory so the receptionist can resume without restarting.

## Does not own

- SMS transport (messaging module)
- Calendar source of truth (booking module)
- Pricing decisions (profile `lookupPricing`)

## Environment

| Variable                               | Default                          | Purpose                                       |
| -------------------------------------- | -------------------------------- | --------------------------------------------- |
| `AI_PROVIDER`                          | `anthropic`                      | `openai_compatible` for Groq staging override |
| `ANTHROPIC_API_KEY`                    | —                                | Live Claude; mock when unset (anthropic mode) |
| `ANTHROPIC_MODEL`                      | `claude-sonnet-5`                | Anthropic model id                            |
| `OPENAI_COMPAT_API_KEY`                | —                                | Groq/OpenAI-compatible key                    |
| `OPENAI_COMPAT_BASE_URL`               | `https://api.groq.com/openai/v1` | Compatible chat completions base URL          |
| `OPENAI_COMPAT_MODEL`                  | `llama-3.3-70b-versatile`        | Compatible model id                           |
| `AI_RECEPTIONIST_ENABLED`              | `true`                           | Kill switch — `false` escalates all           |
| `AI_CONFIDENCE_THRESHOLD`              | `0.8`                            | Escalate below this                           |
| `AI_RECEPTIONIST_MAX_HISTORY_MESSAGES` | `12`                             | History cap per model call                    |
| `MESSAGING_RATE_LIMIT_MAX`             | `30`                             | Inbound SMS per phone per window              |
| `MESSAGING_RATE_LIMIT_WINDOW_MS`       | `60000`                          | Rate-limit window                             |

## Tests & evaluation

- `context.test.ts` — slot merge, session memory, clarification streak, hours summary
- `conversation-memory.test.ts` — prompt memory injection, FAQ topic switch, escalation scenarios
- `flow.test.ts` — booking progression + FAQ non-override
- `escalation.test.ts` — consolidated triggers + injection / frustration / human request
- `structured-output.test.ts` — Zod contract
- `golden-set.harness.test.ts` — regression harness meta-test
- `scenarios.test.ts` — mock Claude end-to-end via dev inbound SMS
- `pnpm receptionist:evaluate` — full golden-set (functional + adversarial)
- `pnpm receptionist:sample-escalations` — weekly escalation review CLI

## Docs

- [docs/AI_RECEPTIONIST_SECURITY.md](../../../docs/AI_RECEPTIONIST_SECURITY.md)
- [docs/AI_RECEPTIONIST_EVALUATION.md](../../../docs/AI_RECEPTIONIST_EVALUATION.md)

## Schema note (prompt library vs Blueprint)

The prompt library references `style_category_id` and `check_availability`; this codebase uses Blueprint-aligned `styleName` / `serviceOfferingId` and `confirm_style_price` / `propose_slots` action names. Behaviour matches Ch.13 intent; only naming differs.

**In-scope FAQ vs Blueprint “out_of_scope chit-chat”:** light courtesy and basic hair recommendations from listed services use `faq`/`general` + `answer_faq`. Medical/legal/unrelated topics remain `out_of_scope` and escalate.
