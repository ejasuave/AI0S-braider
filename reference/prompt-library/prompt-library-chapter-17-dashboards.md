# Chapter 17 — Dashboards

## Overview

This chapter builds the human control surfaces for both stylists and clients: the stylist dashboard shell and navigation, the booking/calendar view, the escalated-conversation inbox (surfacing Chapter 11/13's handoff mechanism), the client-facing dashboard, and the real-time update layer both rely on. Per the Engineering Playbook, the dashboard is explicitly a control surface, not a workflow — value comes from the AI Receptionist handling things autonomously; the dashboard exists for oversight, override, and trust-building, not as the primary interaction model.

## Why This Chapter Exists

Every backend capability built in Chapters 1-16 needs a human-facing surface for the moments the AI can't or shouldn't handle alone — reviewing an escalated conversation, confirming a style-recognition correction, checking today's schedule, or simply trusting that the AI receptionist is doing what it claims. This chapter exists to expose exactly those moments clearly, without accidentally re-creating a full manual-workflow app that undermines the platform's core "the AI handles it" value proposition.

## Prompts in This Chapter

17.1 Stylist dashboard shell and navigation
17.2 Booking/calendar dashboard view
17.3 Escalated conversation inbox
17.4 Client-facing dashboard
17.5 Real-time update layer (WebSocket/SSE)

---

### Prompt 17.1 — Stylist Dashboard Shell and Navigation

**Category:** Dashboards — Foundation
**Objective:** Build the authenticated frontend application shell for the stylist dashboard, establishing navigation, layout, and the data-fetching conventions every subsequent dashboard prompt will build screens within.

**Context:** Requires Chapter 2 (frontend conventions — typed API client, TanStack Query) and Chapter 3/4 (authentication and role guards, since this is an authenticated, stylist-only surface). This is the foundational prompt of the chapter.

**Prompt:**

```
Implement the stylist dashboard application shell in apps/web, following the frontend module conventions from Chapter 1 (src/features/dashboard/) and the data-fetching conventions from Chapter 2 (typed API client, TanStack Query).

Requirements:
- Build an authenticated layout shell with navigation for the sections this chapter and later chapters will populate: Today/Calendar (Prompt 17.2), Conversations (Prompt 17.3), Reviews (Chapter 10, already has a backend, needs a UI home here), Staff (Chapter 4's staff management, needs a UI home here), Settings/Policy (Chapter 6's profile/policy/pricing endpoints, needs a UI home here), and Payouts (Chapter 9's payout/income-report endpoints, needs a UI home here) — this prompt builds the shell and navigation only; each linked section's actual content is either a stub "coming in a later prompt" placeholder or implemented in this chapter's later prompts as noted
- Respect Chapter 4's multi-staff permission model in the navigation itself — a stylist_staff account without a given permission flag (e.g., can_view_payouts) should not see that navigation item at all, rather than seeing it and hitting a FORBIDDEN error after clicking
- Implement the frontend route guard consuming Chapter 3's session/auth state, redirecting unauthenticated users to login and handling an expired/invalid session by triggering Chapter 3's refresh flow transparently before falling back to a login redirect
- Use Chapter 1's frontend-design conventions and the project's established visual direction (consult the frontend-design guidance already in place for this codebase) to ensure the shell feels like a considered product, not a generic admin template
- Write component tests confirming: navigation items are correctly hidden/shown based on the authenticated user's role and permissions, and an expired session correctly triggers the refresh flow rather than an immediate, jarring logout
```

**Expected Output:** An authenticated dashboard shell with permission-aware navigation, transparent session-refresh handling, and stub/placeholder sections for content this chapter's later prompts and other chapters (10, 4, 6, 9) will populate.

**Success Criteria:**

- A `stylist_staff` test account without `can_view_payouts` is confirmed, via test, to not see the Payouts navigation item at all
- An expired session is confirmed, via test, to trigger Chapter 3's refresh flow transparently before any login redirect occurs
- The shell is confirmed to use the typed API client and TanStack Query conventions from Chapter 2, not ad hoc fetch calls, per code review

**Dependencies:** Chapter 1, Chapter 2, Chapter 3, Chapter 4

---

### Prompt 17.2 — Booking/Calendar Dashboard View

**Category:** Dashboards — Core Feature
**Objective:** Build the calendar view where a stylist sees held/confirmed bookings, can toggle approval-mode, and can manually create bookings or resolve flagged calendar conflicts.

**Context:** Requires Prompt 17.1 and Chapter 7 (bookings, manual booking creation), Chapter 7 (Prompt 7.6's conflict resolution endpoints), and Chapter 8 (external calendar sync status).

**Prompt:**

```
Implement the booking/calendar dashboard view in apps/web, within the shell built in Prompt 17.1.

Requirements:
- Build a calendar view (day/week view at minimum) displaying bookings from Chapter 7's booking-history/detail endpoints, visually distinguishing held (pending payment), confirmed, and (for the recent past) completed/cancelled/no_show bookings
- Implement the "approve every booking" toggle referenced in the Engineering Playbook: when enabled, an AI-created held booking requires explicit stylist approval (via a new lightweight approval endpoint this prompt should add to Chapter 7's module — coordinate as a small backend extension, e.g., POST /api/v1/bookings/:bookingId/approve, guarded by requireBusinessPermission('can_manage_bookings')) before the deposit request (Chapter 13, Prompt 13.5) is sent to the client; when disabled (the default, since full automation is the core value proposition), AI-created holds proceed directly to deposit request as already implemented
- Build the manual booking creation UI, calling Chapter 7's Prompt 7.5 manual-booking endpoint, supporting both service-linked and bare-calendar-block creation
- Build a calendar-conflicts view surfacing Chapter 7's Prompt 7.6 `calendar_conflicts` records, letting the stylist resolve each via the existing resolve endpoint
- Display Chapter 8's Google Calendar connection status and a manual "connect calendar" action if not yet connected, linking into Chapter 8's Prompt 8.2 OAuth flow
- Write component tests for the calendar view's status-distinguishing display logic, an integration test for the approval-toggle's effect on a simulated AI-created hold (requiring approval when enabled, proceeding automatically when disabled), and a test for the manual-booking creation form's validation
```

**Expected Output:** A calendar view distinguishing booking statuses, a working approval-mode toggle backed by a new small backend extension to Chapter 7, manual booking creation UI, a calendar-conflicts resolution view, and Google Calendar connection status/action — all with passing tests.

**Success Criteria:**

- The approval-mode toggle is confirmed, via test, to correctly gate an AI-created hold behind explicit stylist approval when enabled, and to proceed automatically (matching existing Chapter 13 behavior) when disabled
- The calendar-conflicts view is confirmed to correctly display and allow resolution of Chapter 7's `calendar_conflicts` records
- The Google Calendar connection status is confirmed to accurately reflect Chapter 8's actual connection state for a test business

**Dependencies:** Prompt 17.1, Chapter 7 (Prompts 7.5, 7.6, plus the new approval endpoint), Chapter 8

---

### Prompt 17.3 — Escalated Conversation Inbox

**Category:** Dashboards — AI Oversight
**Objective:** Build the inbox where a stylist sees and responds to conversations escalated by Chapter 13's AI Receptionist, using Chapter 11's handoff mechanics.

**Context:** Requires Prompt 17.1 and Chapter 11 (Prompt 11.5's escalation/resolution functions and the direct-messaging endpoint) and Chapter 13 (the escalation reasons recorded there, useful for triage display).

**Prompt:**

```
Implement the escalated conversation inbox in apps/web, within the shell built in Prompt 17.1.

Requirements:
- Build an inbox list view querying Chapter 11's conversations with status: escalated for this business, displaying each with its escalation reason (from Chapter 11/13's recorded reason string) prominently, so a stylist can triage — a "structured_output_validation_failed" or "unrecognized_style_image" escalation may warrant different urgency/handling than a "dispute_or_complaint" one
- Build a conversation detail/thread view displaying the full message history (client, ai, and stylist messages, per Chapter 11's schema) in a familiar chat-thread layout, with a message-composition box calling Chapter 11's Prompt 11.5 direct-messaging endpoint to reply
- Implement the resolve action, calling Chapter 11's resolveEscalation function, returning the conversation to active status so the AI Receptionist resumes handling it
- If the escalation relates to a pending style-recognition confirmation (Chapter 14, Prompt 14.4), surface that specific confirm/correct action inline within the conversation view rather than requiring the stylist to navigate to a separate screen for it
- Implement the real-time behavior this view depends on as a placeholder/TODO referencing Prompt 17.5, which implements the actual WebSocket/SSE layer — for now, this prompt can use polling as a functional fallback, to be replaced once Prompt 17.5 lands
- Write component tests for the inbox list's correct display of escalation reasons, an integration test for the resolve action correctly calling Chapter 11's function and updating the UI state, and a test confirming the inline style-recognition-confirmation action correctly calls Chapter 14's Prompt 14.4 endpoint when relevant
```

**Expected Output:** An escalation inbox with reason-based triage display, a full conversation thread view with reply capability, a resolve action, inline style-recognition confirmation where relevant, and a polling-based real-time fallback pending Prompt 17.5 — all with passing tests.

**Success Criteria:**

- The inbox list is confirmed, via test, to correctly display each conversation's specific escalation reason, not a generic "escalated" label
- The resolve action is confirmed, via test, to correctly call Chapter 11's `resolveEscalation` and reflect the updated (non-escalated) state in the UI
- A conversation with a pending style-recognition confirmation is confirmed to surface that action inline, calling Chapter 14's confirm endpoint correctly

**Dependencies:** Prompt 17.1, Chapter 11 (Prompt 11.5), Chapter 13, Chapter 14 (Prompt 14.4)

---

### Prompt 17.4 — Client-Facing Dashboard

**Category:** Dashboards — Client Surface
**Objective:** Build the lightweight client-facing dashboard surfacing Chapter 5's booking history, saved stylists, and profile/preferences — deliberately minimal, consistent with the Playbook's low-friction client account philosophy.

**Context:** Requires Chapter 5 (all the underlying endpoints already exist) and Chapter 2 (frontend conventions). This is a distinct, separate frontend surface from the stylist dashboard shell in Prompt 17.1, since clients and stylists have entirely different roles and needs.

**Prompt:**

```
Implement the client-facing dashboard in apps/web, as a separate authenticated surface from the stylist dashboard shell (Prompt 17.1), following the same Chapter 1/2 frontend conventions.

Requirements:
- Build a booking history view calling Chapter 5's Prompt 5.2 endpoints, with upcoming/past/cancelled filtering, and a detail view for a single booking
- Build a saved-stylists view calling Chapter 5's Prompt 5.3 endpoints, allowing a client to browse and remove saved stylists, with each entry linking through to that stylist's public profile (Chapter 16's search/directory result page, if visibility is enabled, or the stylist's direct booking page otherwise)
- Build a profile/preferences view calling Chapter 5's Prompt 5.1 (profile) and Prompt 5.4 (notification preferences) endpoints, letting a client optionally set a display name/email and manage their reminder/marketing preferences directly (as an alternative to the SMS STOP-keyword mechanism from Chapter 11/12, for clients who prefer a UI over texting a keyword)
- Keep this surface deliberately minimal per the Playbook's philosophy — do not add speculative client-facing features (social sharing, activity feeds, etc.) beyond what Chapter 5's backend already supports
- Write component tests for each of the three views' correct data display and for the profile-update and preference-update forms' correct submission behavior against Chapter 5's endpoints
```

**Expected Output:** A minimal, separate client-facing dashboard surface covering booking history, saved stylists, and profile/preferences, built strictly on Chapter 5's existing endpoints with no speculative scope expansion, with passing component tests.

**Success Criteria:**

- The booking history view's filtering is confirmed, via test, to correctly reflect Chapter 5's upcoming/past/cancelled distinctions
- The preferences view is confirmed, via test, to correctly call Chapter 5's Prompt 5.4 update endpoint and reflect the change
- Code review confirms no feature beyond Chapter 5's existing backend scope was added to this client-facing surface

**Dependencies:** Chapter 5, Chapter 2 (frontend conventions), Chapter 16 (optional linking, non-blocking)

---

### Prompt 17.5 — Real-Time Update Layer (WebSocket/SSE)

**Category:** Dashboards — Infrastructure
**Objective:** Implement the real-time delivery mechanism referenced as a placeholder in Prompt 17.3, replacing polling with genuine push-based updates for new bookings, new escalations, and incoming messages within an escalated conversation.

**Context:** Requires Prompt 17.3 (the polling fallback this prompt replaces) and Chapter 11 (the messaging events this layer needs to push). This is the chapter's closing infrastructure prompt.

**Prompt:**

```
Implement a real-time update layer using WebSocket or Server-Sent Events (choose one consistently — SSE is simpler to implement and sufficient for this platform's one-directional server-to-client push needs, since client-to-server actions already go through standard REST endpoints per Chapter 2's conventions; document this choice) for the stylist dashboard.

Requirements:
- Implement a backend SSE endpoint (or WebSocket connection handler) per authenticated stylist session, pushing events for: a new booking created (held or confirmed), a conversation transitioning to escalated status (Chapter 11, Prompt 11.5), and a new message arriving within a conversation the stylist currently has open in the inbox view (Prompt 17.3)
- Wire this into the existing event/callback patterns already established across the codebase (Chapter 9's payments-subscribe-to-booking-events precedent, reused in Chapters 10, 12, and 16) — this real-time layer should itself subscribe to the same domain events other modules already emit, not require each module to be modified again specifically for this purpose
- Update Prompt 17.3's escalation inbox and Prompt 17.2's calendar view on the frontend to consume this real-time stream (via an SSE client or WebSocket client in apps/web, following Chapter 2's conventions for where such connection-management code should live, e.g., a shared hook in src/shared/lib/) instead of the polling fallback, removing the polling code once the real-time path is confirmed working
- Handle connection interruption gracefully: implement automatic reconnection with backoff on the frontend, and ensure a brief disconnection doesn't cause missed events to be silently lost — on reconnection, trigger a one-time refetch of the relevant data (bookings list, escalation inbox) to reconcile any events missed while disconnected, rather than relying solely on the stream to never drop a message
- Write integration tests covering: a new booking event correctly pushed to a connected stylist session, an escalation event correctly pushed and reflected in a live test of Prompt 17.3's inbox view, and correct reconciliation behavior (a refetch occurring) after a simulated disconnection and reconnection
```

**Expected Output:** A working SSE (or WebSocket) real-time layer reusing existing domain events across the codebase, frontend consumption replacing Prompt 17.3's polling fallback, graceful reconnection with reconciliation refetch, and passing tests for all listed scenarios.

**Success Criteria:**

- A new booking event is confirmed, via test, to be pushed to a connected stylist session in real time, without requiring a poll
- The escalation inbox (Prompt 17.3) is confirmed to update live when a new escalation occurs, with the polling fallback code removed
- A simulated disconnection and reconnection is confirmed, via test, to trigger a reconciliation refetch, ensuring no event is silently and permanently missed

**Dependencies:** Prompt 17.3, Prompt 17.2, Chapter 11 (Prompt 11.5), Chapter 2 (event pattern precedent)

---

## Chapter 17 Summary

At the end of this chapter, both stylists and clients have complete, appropriately-scoped dashboard surfaces: a permission-aware stylist shell with calendar management, an escalation inbox with inline AI-oversight actions, a deliberately minimal client dashboard, and a real-time update layer replacing polling across the board.

**A note on scope discipline carried through this chapter:** every dashboard prompt in this chapter builds a UI on top of an already-existing backend endpoint from an earlier chapter — this chapter introduces almost no new backend business logic (the one small exception being Prompt 17.2's booking-approval endpoint). If a future session implementing this chapter finds itself designing significant new backend logic rather than a UI over existing capability, that's a signal to pause and check whether the underlying capability actually belongs in an earlier chapter instead.

---

Ready to proceed to Chapter 18 (Analytics) when you are.
