# Chapter 11 — Messaging

## Overview

This chapter builds the conversational substrate that both the AI Receptionist (Chapter 13) and human-to-human stylist-client chat depend on: the conversation and message schema, SMS channel integration via Twilio, WhatsApp channel integration, a web chat widget, and the handoff mechanism between AI-handled and human-handled conversation states. Per `ARCHITECTURE.md`, Messaging owns the conversation/message data model and channel delivery; it does not own the content-generation logic itself, which belongs to the AI Receptionist for AI-authored messages.

## Why This Chapter Exists

The AI Receptionist is the platform's core differentiator, but it cannot exist without a reliable, channel-agnostic messaging substrate underneath it — one that persists conversation history, handles multiple channels without the AI Receptionist needing channel-specific logic, and supports clean handoff to a human stylist when needed. This chapter exists to build that substrate as its own concern, so Chapter 13 can focus entirely on conversational intelligence rather than also reinventing message delivery and storage.

## Prompts in This Chapter

11.1 Conversation and message schema
11.2 SMS channel integration (Twilio)
11.3 WhatsApp channel integration
11.4 Web chat widget
11.5 Conversation handoff between AI and human stylist

---

### Prompt 11.1 — Conversation and Message Schema

**Category:** Messaging — Foundation
**Objective:** Create the channel-agnostic `conversations` and `messages` tables that every messaging channel (SMS, WhatsApp, web widget) and every message author (client, AI, stylist) will write to and read from consistently.

**Context:** Requires Chapter 5 (client accounts) and Chapter 6 (stylist/business accounts). This is the foundational prompt of the chapter — no channel integration can be built without this schema existing first.

**Prompt:**

```
Implement the conversation and message schema in a new src/modules/messaging/ module (update ARCHITECTURE.md: owns conversation/message data model and channel delivery; does not own AI-generated message content logic, which is the AI Receptionist's domain per the later Chapter 13 — this module simply stores and delivers messages regardless of who or what authored them).

Requirements:
- Add a conversations table: id, business_id (FK), client_id (FK, nullable — a conversation may begin before a client is fully identified/verified in some channel edge cases, though this should be rare given Chapter 3's OTP verification; document this nullability rationale in a comment), channel (enum: sms, whatsapp, web), status (enum: active, escalated, resolved, abandoned), created_at, last_message_at
- Add a messages table: id, conversation_id (FK), sender (enum: client, ai, stylist), content (text), structured_output (jsonb, nullable — populated for AI-authored messages once Chapter 13 exists; this prompt only needs to reserve the column), created_at
- Implement a channel-agnostic sendMessage(conversationId, sender, content) service function as the single write path every channel integration (Prompts 11.2-11.4) and the future AI Receptionist (Chapter 13) must use — no channel-specific code should write directly to the messages table
- Implement a channel-agnostic receiveMessage(conversationId, content) equivalent for inbound client messages, finding or creating the relevant conversation based on channel-specific identifiers (phone number for SMS/WhatsApp, a session/widget token for web) — the exact lookup logic for each channel is implemented in Prompts 11.2-11.4, but this prompt should define the shared function signature and conversation-resolution contract they'll each call into
- Implement GET /api/v1/businesses/me/conversations and GET /api/v1/conversations/:conversationId (guarded appropriately — stylists see their business's conversations, clients see only their own) as read endpoints, using the shared PaginationParams type from Chapter 2
- Write unit tests for the conversation-resolution logic (creating a new conversation vs. reusing an existing active one for the same client/business/channel combination) and integration tests for the read endpoints' access scoping
```

**Expected Output:** `conversations` and `messages` tables, a shared `sendMessage`/`receiveMessage` service-layer contract that all later channel and AI integrations must use, guarded read endpoints, and passing tests for conversation resolution and access scoping.

**Success Criteria:**

- A repeated inbound message from the same client/business/channel combination correctly reuses an existing `active` conversation rather than creating a duplicate, verified by test
- A client cannot retrieve another client's conversation via the detail endpoint, verified by test
- `ARCHITECTURE.md` is updated with this module's ownership boundary, explicitly noting the deferred `structured_output` column that Chapter 13 will populate

**Dependencies:** Chapter 5, Chapter 6

---

### Prompt 11.2 — SMS Channel Integration (Twilio)

**Category:** Messaging — Channel Integration
**Objective:** Wire Twilio SMS as the platform's first messaging channel, per the pitch's explicit sequencing decision to launch on SMS before WhatsApp given its simpler integration path for a solo/small team.

**Context:** Requires Prompt 11.1 and Chapter 3's `SmsProvider` abstraction (established for OTP delivery — this prompt extends that same abstraction for two-way conversational messaging rather than creating a separate integration).

**Prompt:**

```
Implement SMS channel integration in src/modules/messaging/, extending Chapter 3's existing SmsProvider abstraction rather than creating a parallel Twilio integration.

Requirements:
- Implement the inbound SMS webhook endpoint (Twilio's standard webhook format for incoming messages), following Chapter 2's webhook conventions (signature verification using Twilio's request-signature validation, idempotency via processed_webhook_events keyed on Twilio's message SID) — resolve the sending phone number to a client_id (via Chapter 3's users table) and the receiving Twilio number to the correct business_id, then call Prompt 11.1's receiveMessage function
- Handle the case of an SMS from a phone number with no existing user record: per Chapter 3's account model, an unrecognized inbound SMS should trigger the same lightweight client-account-creation path used by the OTP flow, but note that an inbound SMS itself is not proof of phone ownership in the same way an OTP round-trip is — document this distinction clearly, and ensure any payment/deposit action later in the conversation (Chapter 9) still requires the OTP verification step before charging, even if basic conversational responses can proceed without it
- Implement outbound SMS sending via the extended SmsProvider, called by Prompt 11.1's sendMessage function when a conversation's channel is sms
- Implement the platform-wide STOP-keyword compliance handling: an inbound message containing STOP (or standard opt-out keywords) should call Chapter 5's Prompt 5.4 handleStopKeyword function (the documented integration point that chapter established) rather than reimplementing opt-out logic here
- Handle Twilio delivery-status callbacks (delivered, failed, undelivered) for outbound messages, updating a delivery_status field on the relevant messages row (add this column now if not already present) for basic delivery visibility
- Write integration tests, using Twilio's test credentials/mocked webhook payloads, covering: successful inbound message processing and conversation resolution, STOP-keyword handling correctly delegating to Chapter 5's function, and outbound delivery-status updates being correctly recorded
```

**Expected Output:** A working inbound SMS webhook handler following Chapter 2's conventions, outbound sending through the extended `SmsProvider`, correct new-client handling with the OTP-vs-inbound-SMS trust distinction documented, STOP-keyword delegation to Chapter 5, delivery-status tracking, and passing tests.

**Success Criteria:**

- An inbound SMS from a new phone number correctly creates a lightweight client record and a new conversation, verified by test
- An inbound message containing "STOP" is confirmed, via test, to call Chapter 5's `handleStopKeyword` function rather than independently implemented logic
- Documentation clearly explains why receiving an SMS is not equivalent to OTP verification for payment-authorization purposes

**Dependencies:** Prompt 11.1, Chapter 3 (SmsProvider, OTP model), Chapter 5 (Prompt 5.4)

---

### Prompt 11.3 — WhatsApp Channel Integration

**Category:** Messaging — Channel Integration
**Objective:** Add WhatsApp as a second messaging channel, reusing the channel-agnostic conversation/message contract from Prompt 11.1, as the "fast-follow" channel referenced in the pitch's go-to-market sequencing.

**Context:** Requires Prompt 11.1 and benefits from Prompt 11.2's precedent (the same webhook/conversation-resolution pattern applies, just against a different provider). Requires a Meta/WhatsApp Business API account already provisioned outside this codebase — document this as an external prerequisite, consistent with how Chapter 6's Instagram import prompt handled the same kind of external dependency.

**Prompt:**

```
Implement WhatsApp channel integration in src/modules/messaging/, following the same architectural pattern established in Prompt 11.2 for SMS.

Requirements:
- Note as a prerequisite in the prompt's own documentation: this requires a WhatsApp Business API account (via Meta directly or a Business Solution Provider like Twilio's WhatsApp API) already provisioned outside this codebase, with credentials available via the environment variable system from Chapter 1 — do not attempt to provision this programmatically
- Implement the inbound WhatsApp webhook endpoint following Chapter 2's conventions (signature verification per the provider's specific method, idempotency via processed_webhook_events), resolving to a client_id and business_id and calling Prompt 11.1's receiveMessage function, exactly mirroring Prompt 11.2's SMS pattern but for the whatsapp channel value
- Handle WhatsApp's template-message requirement: outbound messages that initiate a new conversation (rather than replying within an already-open customer-service window) must use a pre-approved message template per WhatsApp Business API policy — implement a small library of pre-approved templates (e.g., booking confirmation, reminder) and ensure the outbound-sending logic in Prompt 11.1's sendMessage correctly selects template-based sending vs. free-form sending based on WhatsApp's customer-service-window rules, since sending a free-form message outside the allowed window will fail
- Reuse the STOP-keyword/opt-out handling from Prompt 11.2, extended to WhatsApp's equivalent opt-out mechanism
- Write integration tests, using mocked WhatsApp Business API responses, covering: inbound message processing mirroring the SMS test pattern, correct template selection for an outside-window outbound message, and correct free-form sending within an open window
```

**Expected Output:** A WhatsApp inbound webhook handler mirroring Prompt 11.2's pattern, a template-message library with correct window-aware selection logic in outbound sending, reused opt-out handling, and passing tests against mocked WhatsApp responses.

**Success Criteria:**

- Inbound WhatsApp message processing correctly resolves to the same `conversations`/`messages` schema as SMS, with `channel: whatsapp`, verified by test
- An outbound message attempted outside the customer-service window is confirmed, via test, to use a pre-approved template rather than attempting (and failing) a free-form send
- The prompt's own documentation clearly notes the external Meta/WhatsApp Business API provisioning prerequisite

**Dependencies:** Prompt 11.1, Prompt 11.2 (architectural precedent)

---

### Prompt 11.4 — Web Chat Widget

**Category:** Messaging — Channel Integration
**Objective:** Implement an embeddable web-based chat widget as a third channel, for clients who discover a stylist through the future public Directory (Chapter 16) or a stylist's own linked booking page rather than texting directly.

**Context:** Requires Prompt 11.1. This is the only channel in this chapter requiring frontend (`apps/web`) work in addition to backend — coordinate with Chapter 2's established frontend conventions (typed API client, TanStack Query).

**Prompt:**

```
Implement a web chat widget as a messaging channel, with both backend and frontend components, following the architectural pattern from Prompts 11.2-11.3 on the backend and Chapter 2's frontend conventions for the widget UI.

Requirements:
- Backend: implement a session-token-based conversation resolution for the web channel (since there is no phone number to key on) — issue a short-lived, unauthenticated widget session token when a visitor opens the chat widget on a stylist's public booking page, and use that token (not a full user account) to resolve/create the conversation via Prompt 11.1's receiveMessage contract; if the visitor completes a booking and goes through Chapter 3's OTP verification mid-conversation, link the anonymous session's conversation to their now-known client_id
- Backend: implement WebSocket or Server-Sent Events support (consistent with the real-time approach Chapter 17's dashboard will also use) so widget messages appear in real time without polling, for both the client's widget view and (once escalated, per Prompt 11.5) the stylist's dashboard view
- Frontend: build the chat widget as an embeddable component in apps/web, following the module conventions from Chapter 1 (e.g., src/features/chat-widget/), using the typed API client and query patterns from Chapter 2 — the widget should be embeddable on a stylist's public profile page (Chapter 16) and function as a small, unobtrusive floating chat interface
- Frontend: handle the transition from anonymous widget session to verified client cleanly in the UI — e.g., prompting for phone verification only when the conversation reaches a point requiring it (booking a deposit), not upfront before any conversation can happen, consistent with the low-friction philosophy established throughout the Playbook
- Write integration tests for the backend session-token resolution and linking logic, and component/interaction tests for the frontend widget's message-sending and real-time-receiving behavior
```

**Expected Output:** Backend session-token-based conversation resolution with anonymous-to-verified linking, real-time message delivery infrastructure, a frontend embeddable chat widget component using established conventions, and passing tests for both backend logic and frontend interaction.

**Success Criteria:**

- An anonymous widget visitor can converse without any upfront verification, and their conversation is correctly linked to their `client_id` once they verify via OTP mid-conversation, verified by test
- Messages sent in the widget appear in real time without requiring a page refresh or poll
- The widget component is confirmed, via code review, to use the typed API client and query-key conventions from Chapter 2 rather than ad hoc fetch calls

**Dependencies:** Prompt 11.1, Chapter 2 (frontend conventions), Chapter 3 (OTP linking)

---

### Prompt 11.5 — Conversation Handoff Between AI and Human Stylist

**Category:** Messaging — Handoff
**Objective:** Implement the mechanism by which a conversation transitions from AI-handled to stylist-handled and back, since Chapter 13's AI Receptionist will need to escalate certain conversations to a human, and a stylist needs a clean way to respond within the same conversation thread the client sees.

**Context:** Requires Prompt 11.1 and anticipates Chapter 13's escalation logic — this prompt builds the messaging-layer mechanics of handoff now, so Chapter 13 can focus purely on the confidence-threshold decision logic and simply call into this contract.

**Prompt:**

```
Implement conversation handoff mechanics in src/modules/messaging/, as the documented integration point Chapter 13's AI Receptionist will call when escalating a conversation.

Requirements:
- Implement an escalateConversation(conversationId, reason) service function that transitions a conversations row's status to escalated, and notifies the stylist (reusing Chapter 3/12's notification-provider abstractions — an escalation should trigger an actual notification, not just a silent status flag, since a stylist who doesn't know a conversation needs them defeats the purpose of escalation)
- Once a conversation is escalated, any subsequent inbound message from the client should still be stored via Prompt 11.1's receiveMessage, but the AI Receptionist (once Chapter 13 exists) must check the conversation's status before attempting to auto-respond — implement this as an isEscalated(conversationId) check this module exposes for Chapter 13 to call before generating any AI response, ensuring the AI does not talk over a human stylist who has taken over
- Implement a resolveEscalation(conversationId) function, callable by the stylist (guarded by requireBusinessPermission('can_manage_bookings')), transitioning status back to active once the stylist has addressed the issue, allowing the AI Receptionist to resume handling the conversation
- Implement POST /api/v1/conversations/:conversationId/messages for a stylist to send a message directly into an escalated conversation from the dashboard (Chapter 17 will build the UI; this prompt builds the API), using Prompt 11.1's sendMessage with sender: stylist, correctly routed back out to the client via whatever channel the conversation is on
- Add an escalations table (or reuse Chapter 5's cross-reference if a similar structure exists — check for duplication before creating a new table): id, conversation_id (FK), reason, created_at, resolved_at (nullable), resolved_by (FK to users, nullable)
- Write integration tests covering: escalation correctly notifying the stylist and updating status, a subsequent inbound client message during an escalated conversation being stored but not auto-responded-to (simulate by asserting isEscalated returns true and no AI-response-generation code path is triggered, since Chapter 13 doesn't exist yet to fully test this end-to-end), a stylist's direct message correctly routing to the client's channel, and resolution correctly returning the conversation to active status
```

**Expected Output:** `escalateConversation`, `isEscalated`, and `resolveEscalation` functions forming the documented handoff contract for Chapter 13, a stylist-to-client direct messaging endpoint, correct notification on escalation, and passing tests for the full handoff lifecycle.

**Success Criteria:**

- Escalating a conversation is confirmed, via test, to trigger an actual stylist notification, not just a silent database status change
- `isEscalated` correctly returns true immediately after escalation and false after resolution, verified by test
- A stylist's message sent via the direct-messaging endpoint is confirmed to route to the correct outbound channel (SMS, WhatsApp, or web widget) matching the conversation's original channel

**Dependencies:** Prompt 11.1, forward-reference to Chapter 13 (which will consume `isEscalated` and call `escalateConversation`)

---

## Chapter 11 Summary

At the end of this chapter, the platform has a complete, channel-agnostic messaging substrate: SMS and WhatsApp as inbound/outbound channels, a web chat widget with anonymous-to-verified session linking, and a full AI-to-human handoff mechanism. Chapter 13's AI Receptionist will be built entirely on top of this chapter's `sendMessage`/`receiveMessage`/`escalateConversation`/`isEscalated` contracts rather than reimplementing any channel or conversation-state logic.

**Two contracts from this chapter are the most important to preserve exactly as documented when Chapter 13 is built:** the `receiveMessage`/`sendMessage` channel-agnostic write path (Prompt 11.1) and the `escalateConversation`/`isEscalated`/`resolveEscalation` handoff mechanism (Prompt 11.5). Chapter 13 should be reviewed against these contracts specifically if its implementation seems to be duplicating channel or state-management logic that already exists here.

---

Ready to proceed to Chapter 12 (Notifications) when you are.
