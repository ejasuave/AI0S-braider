# The Prompt Library

## A Complete Engineering Handbook for Building [Platform Name] with Claude Code and Cursor

**Document status:** Outline for approval — no chapter content written yet
**Purpose of this document:** Table of contents + full structural outline. Each chapter listed below will be written in full (10-25 pages, prompts fully detailed) only after you approve this structure.

---

## Table of Contents

- Front Matter: How to Use This Library
- Chapter 1 — Project Setup
- Chapter 2 — Architecture
- Chapter 3 — Authentication
- Chapter 4 — User Roles & Permissions
- Chapter 5 — Customer Features
- Chapter 6 — Stylist Features
- Chapter 7 — Booking Engine
- Chapter 8 — Calendar & Availability
- Chapter 9 — Payments & Deposits
- Chapter 10 — Reviews
- Chapter 11 — Messaging
- Chapter 12 — Notifications
- Chapter 13 — AI Receptionist
- Chapter 14 — AI Hairstyle Recognition
- Chapter 15 — AI Business Assistant
- Chapter 16 — Search
- Chapter 17 — Dashboards
- Chapter 18 — Analytics
- Chapter 19 — Admin Panel
- Chapter 20 — Security
- Chapter 21 — Performance
- Chapter 22 — Testing
- Chapter 23 — Deployment
- Chapter 24 — Mobile Optimisation
- Chapter 25 — Future Features
- Back Matter A — Complete Build Order
- Back Matter B — MVP / V2 / V3 Classification
- Back Matter C — Prompts That Should Never Be Skipped
- Back Matter D — Common Mistakes with AI Coding Assistants
- Back Matter E — Best Practices for Claude Code and Cursor
- Back Matter F — Prompt Dependency Map
- Back Matter G — New Chat vs. Continue Chat Guidance

---

## Front Matter: How to Use This Library

Explains the numbering system (Chapter.Prompt, e.g. 7.3), the fixed structure every prompt follows (Objective, Context, Prompt, Expected Output, Success Criteria, Dependencies), how prompts assume an existing codebase, and how to navigate between this library and the Engineering Playbook (system-design reference) produced earlier — the Playbook defines _what_ to build; this library defines _how to instruct the AI to build it_.

---

## Chapter Outlines

Each entry below shows: chapter purpose, and the full ordered prompt list that chapter will contain once written.

### Chapter 1 — Project Setup

**Purpose:** Establish the repository, tooling, and conventions every later prompt will assume exist.
1.1 Initialize monorepo/project structure
1.2 Configure TypeScript, linting, and formatting standards
1.3 Set up environment variable management and secrets strategy
1.4 Configure the primary database and ORM
1.5 Set up CI pipeline skeleton (lint, typecheck, test on every PR)
1.6 Establish folder/module conventions for frontend and backend
1.7 Configure local development environment (Docker or equivalent)
1.8 Set up error tracking and logging baseline

### Chapter 2 — Architecture

**Purpose:** Encode the service boundaries and architectural principles from the Engineering Playbook into instructions the AI must follow on every subsequent build.
2.1 Define service boundary documentation the AI must respect
2.2 Establish API layer conventions (REST/GraphQL standards, versioning)
2.3 Establish shared type/schema conventions between frontend and backend
2.4 Define the internal API gateway/BFF pattern (if used)
2.5 Set up background job/worker infrastructure
2.6 Establish event/webhook handling conventions (idempotency, retries)

### Chapter 3 — Authentication

**Purpose:** Build the identity foundation every other feature depends on.
3.1 Implement core user schema and password auth
3.2 Implement phone-based OTP verification
3.3 Implement OAuth (Google/Apple) login
3.4 Implement session/refresh token handling with rotation
3.5 Implement account recovery flows
3.6 Implement rate limiting on auth endpoints

### Chapter 4 — User Roles & Permissions

**Purpose:** Define who can do what, before any feature that depends on role checks is built.
4.1 Implement role schema (client, stylist_owner, stylist_staff, admin)
4.2 Implement role-based route/API guards
4.3 Implement stylist multi-staff permission scoping
4.4 Implement admin impersonation/support access (with audit logging)

### Chapter 5 — Customer Features

**Purpose:** Everything a client-side user interacts with outside of booking itself.
5.1 Client signup/lightweight account creation
5.2 Client profile and booking history view
5.3 Client saved stylists/favorites
5.4 Client notification preferences management

### Chapter 6 — Stylist Features

**Purpose:** Everything a stylist configures about their business.
6.1 Stylist profile creation and editing
6.2 Portfolio upload and management (manual)
6.3 Instagram import integration
6.4 Service/pricing list management (structured taxonomy)
6.5 Deposit and cancellation policy configuration
6.6 Working hours and availability rules

### Chapter 7 — Booking Engine

**Purpose:** The core transactional system of the platform.
7.1 Booking state machine implementation
7.2 Slot hold creation with TTL expiry
7.3 Booking confirmation flow
7.4 Cancellation and no-show handling
7.5 Manual/dashboard-created bookings
7.6 Booking conflict detection and resolution

### Chapter 8 — Calendar & Availability

**Purpose:** Keep the platform's schedule truthful against both internal and external calendars.
8.1 Availability computation engine
8.2 Google Calendar two-way sync
8.3 Buffer time and duration-aware slot generation
8.4 Calendar reconciliation background job

### Chapter 9 — Payments & Deposits

**Purpose:** Move money correctly, safely, and idempotently.
9.1 Stripe Connect onboarding for stylists
9.2 Deposit PaymentIntent creation and capture
9.3 Refund and forfeiture logic
9.4 Webhook handling with idempotency
9.5 Payout scheduling and reporting
9.6 Chargeback/dispute evidence handling

### Chapter 10 — Reviews

**Purpose:** Build trust signals into the directory.
10.1 Review submission flow (post-appointment only)
10.2 Review moderation and fraud detection
10.3 Stylist response-to-review capability
10.4 Review aggregation and rating computation

### Chapter 11 — Messaging

**Purpose:** The conversational substrate the AI Receptionist and human-to-human chat both use.
11.1 Conversation and message schema
11.2 SMS channel integration (Twilio)
11.3 WhatsApp channel integration
11.4 Web chat widget
11.5 Conversation handoff between AI and human stylist

### Chapter 12 — Notifications

**Purpose:** Timely, non-duplicative communication across channels.
12.1 Notification schema and delivery worker
12.2 Appointment reminder scheduling
12.3 Confirmation/cancellation notifications
12.4 Opt-out/compliance handling (STOP keyword, etc.)

### Chapter 13 — AI Receptionist

**Purpose:** The platform's primary differentiator — the conversational booking agent.
13.1 Core conversation state management
13.2 Structured-output contract and schema validation
13.3 Intent classification and slot extraction
13.4 Availability and pricing lookup integration
13.5 Deposit request generation within conversation
13.6 Escalation logic and confidence thresholds
13.7 Prompt-injection resistance and untrusted-input handling
13.8 Conversation evaluation/regression test harness

### Chapter 14 — AI Hairstyle Recognition

**Purpose:** The long-term moat feature — image-based style, price, and duration estimation.
14.1 Image upload and preprocessing pipeline
14.2 Style classification against structured taxonomy
14.3 Confidence scoring and low-confidence escalation
14.4 Stylist confirmation/correction interface
14.5 Model evaluation benchmark harness

### Chapter 15 — AI Business Assistant

**Purpose:** Phase 2 capability — natural-language business insights for stylists.
15.1 Natural-language query interface for stylist data
15.2 Read-only scoped data access layer for the assistant
15.3 Rebooking/win-back suggestion generation
15.4 Revenue and schedule-gap query handling

### Chapter 16 — Search

**Purpose:** Public discovery layer.
16.1 Search index schema and sync pipeline
16.2 Location/style/price filter implementation
16.3 Availability-aware ranking
16.4 Search abuse/scraping protection

### Chapter 17 — Dashboards

**Purpose:** The human control surfaces for stylists and clients.
17.1 Stylist dashboard shell and navigation
17.2 Booking/calendar dashboard view
17.3 Escalated conversation inbox
17.4 Client-facing dashboard (booking history, upcoming appointments)
17.5 Real-time update layer (WebSocket/SSE)

### Chapter 18 — Analytics

**Purpose:** Business intelligence for stylists and for the platform itself.
18.1 Stylist-facing analytics (revenue, repeat rate, popular styles)
18.2 Platform-level analytics and metrics pipeline
18.3 Funnel/conversion tracking for booking flow

### Chapter 19 — Admin Panel

**Purpose:** Internal tooling for platform operations and support.
19.1 Admin authentication and access control
19.2 Stylist account management and support tools
19.3 Dispute/escalation review tools
19.4 Platform-wide monitoring dashboard

### Chapter 20 — Security

**Purpose:** Cross-cutting hardening pass applied after core features exist.
20.1 Security audit prompt for auth flows
20.2 PII encryption and access-control audit
20.3 Rate limiting and abuse-prevention audit
20.4 Dependency and vulnerability scanning setup

### Chapter 21 — Performance

**Purpose:** Cross-cutting optimization pass.
21.1 Database query and index audit
21.2 API response time optimization
21.3 Frontend bundle/performance audit
21.4 Caching strategy implementation

### Chapter 22 — Testing

**Purpose:** Establish and backfill test coverage across the codebase.
22.1 Unit test coverage baseline and gap analysis
22.2 Integration test suite for booking/payment flows
22.3 AI conversation regression test suite
22.4 End-to-end test suite (critical user journeys)

### Chapter 23 — Deployment

**Purpose:** Ship safely and repeatably.
23.1 CI/CD pipeline finalization
23.2 Staging environment configuration
23.3 Production deployment and rollback strategy
23.4 Database migration safety practices

### Chapter 24 — Mobile Optimisation

**Purpose:** Ensure the responsive web app performs as a primary mobile experience.
24.1 Responsive layout audit across core flows
24.2 Touch/interaction optimization
24.3 Mobile performance (load time, image optimization)
24.4 PWA/installability considerations

### Chapter 25 — Future Features

**Purpose:** Documented but deliberately deferred capabilities, written so a future team (or future you) can pick them up without re-deriving context.
25.1 Waitlist functionality
25.2 Multi-staff salon support expansion
25.3 Marketplace commission/take-rate layer
25.4 Product/affiliate marketplace
25.5 Training/course hosting for stylists

---

## Back Matter — Structure Preview

- **Complete Build Order:** a single linear sequence across all 25 chapters from prompt 1.1 through final deployment, respecting dependencies.
- **MVP / V2 / V3 Classification:** every prompt tagged into one of three build horizons.
- **Never-Skip List:** the small set of prompts (security, idempotency, escalation logic) that must never be deferred regardless of timeline pressure.
- **Common Mistakes with AI Coding Assistants:** patterns like vague prompts, missing context, letting the AI invent schema instead of following the Playbook, skipping tests to move fast.
- **Best Practices for Claude Code and Cursor:** how to structure sessions, when to paste in existing code vs. describe it, how to review AI output critically.
- **Prompt Dependency Map:** a visual/tabular map of which prompts block which.
- **New Chat vs. Continue Chat Guidance:** rules of thumb for context window management across a long build.

---

## Notes on Scope

This outline plans for **~115 prompts** across 25 chapters (ranging from 4 prompts in smaller chapters like Reviews to 8 in larger ones like AI Receptionist), satisfying the 100-prompt minimum with room for the back matter to reference all of them meaningfully in the build order and dependency map.

Each chapter, once written, will follow this per-prompt structure for every numbered prompt:

- **Objective** — what this prompt accomplishes
- **Context** — what must already exist in the codebase for this prompt to make sense
- **Prompt** — the full copy-pasteable instruction for Claude Code / Cursor
- **Expected Output** — what files/behavior should result
- **Success Criteria** — how to verify it worked
- **Dependencies** — which earlier prompts this relies on

---

**Awaiting your approval to proceed.** Once approved, I'll write Chapter 1 in full, then wait for your go-ahead before each subsequent chapter. Let me know if you'd like any chapter added, removed, reordered, or rescoped before I begin.
