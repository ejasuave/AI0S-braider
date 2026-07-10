# Product Blueprint — Project Braids

**Document status:** Approved (Phase 0, 2026-07-10)  
**Codename:** Project Braids (`PLATFORM_DISPLAY_NAME` via environment variable)  
**Version:** 1.0  
**Last updated:** 2026-07-10  
**Market:** UK only at launch (GBP, UK phone numbers, UK GDPR/PECR)

---

## How this document relates to other references

| Document | Role | When to read |
|----------|------|--------------|
| **This Product Blueprint** | Single source of truth for product, brand, UX, stack, and behavioural rules | Every session — before any product or implementation decision |
| [Engineering Playbook](engineering-playbook.md) | Per-system architecture: schemas, flows, edge cases, security, testing | Before building a specific system (Identity, Booking, AI, etc.) |
| [Prompt Library Outline](../prompt-library/outline.md) + [Back Matter](../prompt-library/back-matter.md) | How to instruct AI to build it: prompts, build order, milestones | When executing a chapter/prompt |
| [Detailed Pitch](detailed-pitch.md) | GTM narrative and business context | Strategy and positioning only — Blueprint supersedes for build decisions |

**Conflict resolution:** If documents disagree, flag explicitly. Priority: **founder decision → Product Blueprint → Back Matter → Playbook → Pitch**. Never silently override a settled decision.

---

## 1. Product principles

### What we are building

An **AI receptionist and operating system** for independent hair braiders and hairstylists — not a generic salon booking platform. The core unit of value is a **completed, confirmed, paid booking** created with minimal manual effort from the stylist.

### Design north star

*"Your business finally has a front desk."* — Structured and trustworthy like a booking platform; warm and culturally fluent like the beauty world; never cold or corporate.

### Ten product principles

1. **The conversation is the product** — Architecture and UX serve conversational booking, not the reverse.
2. **Tool before marketplace** — Prove value to stylists' existing clients before public discovery (Ch.16 V2).
3. **Trust before beauty** — Deposits, policies, and confirmations must be crystal clear.
4. **Never hallucinate pricing** — Prices come from structured `service_offerings` data; the AI extracts intent, the application quotes price.
5. **Escalate when uncertain** — Low confidence or dispute → stylist, never guess.
6. **The dashboard is a control surface** — Stylists should rarely need it; it exists for override, trust, and reporting.
7. **Idempotency everywhere messages or payments retry** — Webhooks and SMS both retry.
8. **Multi-tenant by design** — Each stylist is a tenant; clients are platform-wide by phone.
9. **Mobile-first web** — Launch is a responsive web app; stylists manage their business from phones. Design and build for small screens first, enhance for desktop.
10. **API-first for future native** — Business logic lives in `apps/api`; web is one client. Native iOS/Android later without backend rewrites.
11. **Build sustainably** — Solo founder + AI tools; no process that assumes a large team.

### What we are not building (MVP)

- Native iOS/Android apps (future — APIs designed to support them)
- Public marketplace / directory search (V2)
- AI hairstyle recognition from photos (V3)
- WhatsApp channel (V2 fast-follow after SMS)
- Web booking form page and embeddable chat widget (V2)
- Full analytics platform (V2)
- Reviews (V2)
- Outlook calendar sync (out of scope)
- OpenAI, LangGraph, Supabase Auth

---

## 2. Brand identity

### Positioning

| vs | They feel like | We feel like |
|----|----------------|--------------|
| Instagram DMs | Visual, chaotic, no structure | Structured booking with portfolio warmth |
| WhatsApp | Personal, no guardrails | Conversational warmth + deposits + calendar truth |
| StyleSeat / Vagaro | Calendar-first, salon-generic | Intelligence-first receptionist for braiders |

**One line:** The professionalism of a booking platform, with the warmth of a DM — minus the chaos.

### Brand personality

| Audience | Primary feeling |
|----------|----------------|
| Stylist | "My business runs even when I'm at the chair" |
| Client | "This is easy and I know what I'm paying" |
| Both | Trust, warmth, control |

### Voice and tone

- British English
- Clear, warm, direct — like a brilliant receptionist
- No corporate jargon; no excessive emoji
- Example: *"Your booking is confirmed — Friday, 2pm. £30 deposit paid."*

### Visual identity (summary)

Full tokens in [design/visual-identity-and-ux.md](../design/visual-identity-and-ux.md).

| Element | Rule |
|---------|------|
| Palette | Warm neutrals + cocoa ink + honey-gold primary (`#B8860B`); AI accent purple (`#6B4C9A`) |
| Typography | Fraunces (headings) + DM Sans (UI) |
| Components | shadcn/ui themed to design tokens |
| Stylist override | `--color-stylist-accent` on their client-facing surfaces (V2) |
| Phase 1 UI | Light mode only; dashboard + onboarding (web surfaces V2) |

---

## 3. Target users

### Primary: Independent stylists (tenant)

- Hair braiders and hairstylists running solo businesses
- Currently book via Instagram, TikTok, WhatsApp, word of mouth
- Lose time to DM overhead and money to no-shows on multi-hour appointments
- Non-technical; need daily-usable simplicity
- UK-based at launch

### Secondary: Clients (platform-wide identity)

- Existing clients of a stylist — not marketplace-acquired strangers in MVP
- Book via **SMS to AI receptionist** in MVP
- Lightweight identity: phone + OTP before deposit; no full account required
- One platform-wide client record per phone; each stylist sees only their relationship

### Explicitly not targeting (MVP)

- Salon chains / multi-location enterprises (V3 / Ch.25)
- Clients discovering stylists via public search (V2)

---

## 4. Core user journeys

### Journey A — Stylist goes live (MVP)

Sign up → verify phone (SMS OTP) → upload portfolio (manual) → set structured pricing → set policies + hours → connect Stripe → share SMS booking number → clients book via AI.

**Target:** Under 15 minutes to live.

### Journey B — Client books via SMS (MVP)

Texts stylist's number → AI identifies style → looks up price from taxonomy → checks availability → proposes slots → client picks → OTP → deposit link → confirmation SMS.

**Stylist sees:** *"New booking confirmed — Friday 2pm, £30 deposit paid."*

### Journey C — Stylist handles escalation (MVP)

Push notification → escalation inbox → read AI context → reply inline or take over → client sees stylist message in same thread.

### Journey D — Stylist morning check-in (MVP)

Open dashboard → today's bookings → pending escalations → close app (~30 seconds).

### Journey E — Client books via web (V2)

Shareable multi-step form (`/s/:slug`) OR embeddable AI chat widget — same backend services as SMS.

### Journey F — Public discovery (V2)

Search by location/style → profile card → enters same AI receptionist flow as direct SMS.

---

## 5. Feature roadmap (Prompt Library MVP / V2 / V3)

Authoritative classification from [back-matter.md](../prompt-library/back-matter.md) §2. Founder conflict resolution: **Back Matter wins** for MVP scope.

### MVP (~weeks 1–14 → public beta M7)

| Ch | Feature | Key prompts |
|----|---------|-------------|
| 1 | Project setup | 1.1–1.8 |
| 2 | Architecture conventions | 2.1–2.6 |
| 3 | Authentication | 3.1–3.6 |
| 4 | Roles (basic) | 4.1–4.2 only |
| 6 | Stylist profile, manual portfolio, **pricing taxonomy**, policies, hours | 6.1–6.2, 6.4–6.6 |
| 7 | Booking engine (state machine, holds, concurrency) | 7.1–7.6 |
| 8 | Availability (core) | 8.1, 8.3 only |
| 9 | Stripe Connect, deposits, webhooks | 9.1–9.5 |
| 11 | SMS messaging | 11.1, 11.2, 11.5 |
| 12 | Notifications, reminders, STOP compliance | 12.1–12.4 |
| 13 | **AI Receptionist** | 13.1–13.8 (never skip 13.6, 13.7) |
| 17 | Stylist dashboard (minimal) | 17.1–17.3 |
| 23 | Deployment | 23.1–23.4 |
| 24 | Mobile baseline | 24.1 |

**MVP client channel:** SMS only.  
**MVP monetization:** All stylists free during pilot; paid tiers at beta transition per Back Matter §10.

### V2 (months 5–8, post-pilot feedback)

| Ch | Feature |
|----|---------|
| 4.3–4.4 | Multi-staff, admin impersonation |
| 5 | Customer app features |
| 6.3 | Instagram import |
| 8.2, 8.4 | Google Calendar two-way sync |
| 9.6 | Chargeback/dispute automation |
| 10 | Reviews |
| 11.3–11.4 | WhatsApp, web chat widget |
| — | Shareable booking form page |
| 15 | AI business assistant |
| 16 | Public search/directory |
| 17.4–17.5 | Client dashboard, real-time updates |
| 18 | Analytics (8 metrics + funnel) |
| 19 | Admin panel |
| 20–22 | Security audit, performance, test consolidation |
| 24.2–24.4 | Mobile polish, PWA |

### V3 (opportunistic, trigger-conditioned per Ch.25)

| Ch | Feature |
|----|---------|
| 14 | AI hairstyle recognition |
| 25 | Waitlist, take-rate, salon expansion, affiliate marketplace, training — each gated by its own trigger |

### Critical path (cannot shorten)

```
Ch1 → Ch2 → Ch3 → Ch4(4.1-4.2) → Ch6(6.4) → Ch7 → Ch9(9.1-9.2) → Ch11(11.1-11.2) → Ch13 → Ch23 → Beta
```

### Milestones

| Milestone | Exit criteria |
|-----------|---------------|
| M1 Foundation | Ch 1–2; CI green; `ARCHITECTURE.md` accurate |
| M3 Auth | Ch 3–4; role scoping tested |
| M4 Booking | Ch 6–8 MVP; concurrency hold test passes |
| M5 Payments | Ch 9; webhook audit passes |
| M6 AI | Ch 11–13; golden + adversarial suites pass |
| M7 Public beta | 10–20 stylists; 1 week no P0/P1 |
| M8 Public launch | Production readiness checklist complete |

---

## 6. Design system rules

### Launch platform: responsive web, mobile-first

**The product launches as a responsive web application** — not a native app, not desktop-only. Independent stylists overwhelmingly manage their business from phones; every page and component must be designed and built **mobile-first** (small screen → tablet → desktop), not desktop with a responsive afterthought.

| Rule | Requirement |
|------|-------------|
| Design order | Mobile layout first in every feature; desktop is enhancement |
| Touch | Min 44×44px targets; no hover-only interactions on touch surfaces |
| Navigation | Bottom nav on mobile dashboard; thumb-zone primary CTAs |
| Forms | Single column on mobile; fixed bottom CTA where appropriate |
| Calendar | Week view default on mobile; tappable slot pills |
| Performance | LCP < 2.5s on 4G for client-facing pages (Ch.24.3 budget) |
| Ch.24 MVP | 24.1 baseline layout correctness ships with beta |

**V2:** PWA/installability (Ch.24.4), deeper mobile polish (24.2–24.3).  
**Future:** Native iOS/Android apps consume the same API — see §7 Client architecture.

Implement via Tailwind + shadcn/ui theme in `packages/config` or `apps/web`. Full spec: `reference/design/visual-identity-and-ux.md`.

### Layout

- Mobile-first; min touch target 44×44px
- Dashboard max width 1120px; booking form 480px (V2); widget 400px (V2)
- Bottom nav on mobile dashboard: Home, Calendar, Messages, Earnings, More

### Components

- One primary CTA per viewport
- Status always text + colour (never colour alone)
- Skeleton loading preferred over spinners
- Chat bubbles for widget (V2); stepper for form (V2)
- AI messages use purple accent; always labelled on first interaction

### Accessibility

- WCAG 2.1 AA target
- Visible focus rings; `aria-live` for chat and confirmations
- Respect `prefers-reduced-motion`

### UX rules by surface

| Surface | Rule |
|---------|------|
| Onboarding | Incremental save; checklist progress; sensible defaults |
| Dashboard | Escalations top priority; glanceable home |
| SMS booking | Under 3 minutes to confirmed booking |
| Payments | Policy visible before deposit; Stripe-hosted only |

---

## 7. Technical architecture rules

### Stack (settled — do not reinvent)

| Layer | Technology |
|-------|------------|
| Frontend | Next.js, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | Node.js, Fastify, TypeScript |
| Database | PostgreSQL via Supabase (hosting only) |
| ORM | Prisma (singleton client; pooler in production) |
| Object storage | Supabase Storage Phase 1 via `StorageProvider` abstraction |
| AI | Anthropic Claude API — stateless orchestration only |
| Payments | Stripe Connect |
| Calendar | Google Calendar two-way sync (V2); Outlook out of scope |
| Messaging | Twilio SMS (MVP) → WhatsApp (V2 fast-follow); email (Resend/Postmark) for account mail |
| Jobs | Redis (Upstash or platform Redis) + background workers |
| Hosting | Vercel (web); Railway / Render / Fly.io (api + workers) |

### Excluded permanently (unless founder explicitly revisits)

- OpenAI, LangGraph, other agent frameworks
- Supabase Auth
- Outlook calendar
- Public marketplace in MVP

### Service boundaries (from Playbook §1.4)

| Module | Owns | Does not own |
|--------|------|--------------|
| identity | Auth, sessions, roles | Profile content |
| profile | Bio, portfolio, pricing, policies | Availability logic |
| booking | Slots, holds, confirmations, cancellations | Payment capture |
| receptionist | Conversation state, intent, price lookup | Calendar source of truth |
| payments | Deposits, refunds, payouts | Pricing decisions |
| notifications | Delivery of reminders | Content generation (delegates to receptionist) |
| messaging | Channel ingress/egress | Business logic |

### Cross-module rules

- Features live in `apps/api/src/modules/<feature>/` and `apps/web/src/features/<feature>/`
- **Never** query another module's tables directly — go through owning service
- All tenant data scoped by `stylist_id` from auth middleware
- Webhooks: idempotency key on every handler (Stripe event ID, etc.)
- Update `docs/ARCHITECTURE.md` in the same commit as boundary changes

### Client architecture: web now, native later

This is **reinforcement** of Ch.2 Architecture + Playbook patterns — not a new stack. Final check before coding:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────────────────┐
│  apps/web   │     │ Future      │     │      apps/api           │
│  (Next.js)  │     │ iOS/Android │────▶│  REST + shared-types    │
│  MVP launch │────▶│   (later)   │     │  All business logic     │
└─────────────┘     └─────────────┘     └─────────────────────────┘
       │                                           │
       └─ typed API client (Ch.2.3)                └─ Prisma, Claude, Stripe, Twilio
          TanStack Query hooks                      Webhooks, jobs, AI orchestration
          No business logic in components
```

| Principle | Implementation (Ch.2) | Why native-ready |
|-----------|----------------------|------------------|
| **API is the product surface** | All mutations/reads via `apps/api` REST endpoints | Native app calls same routes |
| **Shared contract** | `packages/shared-types` — Zod schemas + TS types for request/response | Generate/consume same shapes on mobile |
| **Typed API client** | `apps/web/src/shared/lib/api-client.ts` — sole HTTP layer | Mobile reimplements thin client against same OpenAPI/types |
| **No logic in components** | UI in `features/`; data via TanStack Query hooks calling API client | Business rules stay in API modules |
| **No Next-only business paths** | No Server Actions as canonical write path; API endpoints are canonical | Native cannot run Server Actions |
| **Thin web BFF (optional)** | Next.js may set HttpOnly refresh cookies, proxy auth — not business rules | Web-specific transport only |
| **Auth transport** | Web: HttpOnly cookie + refresh rotation (Playbook Ch.2); API also accepts `Authorization: Bearer` for future native secure storage | Playbook already distinguishes web vs mobile session storage |
| **Real-time** | SSE/WebSocket endpoints on API (Ch.17.5 V2) | Native subscribes to same events |
| **Versioning** | `/api/v1/` prefix (Ch.2.2) | Mobile apps pin to stable version |

**Explicit anti-patterns (forbid in code review):**

- Prisma or service calls from `apps/web` (except truly web-only concerns like cookie setting)
- Duplicated validation logic — Zod schemas live in `shared-types`, validated on API; web imports types only
- Booking/payment/AI orchestration inside React components or Next.js route handlers
- Hard-coded API shapes in frontend — always import from `shared-types`

**Ch.2 prompts that enforce this:** 2.2 (API conventions), 2.3 (shared types), 2.4 (BFF boundary if used), plus `docs/API_CONVENTIONS.md`.

### Repository layout

```
apps/web/          # Next.js
apps/api/          # Fastify
packages/shared-types/
packages/config/
docs/              # ARCHITECTURE.md, API_CONVENTIONS.md, etc.
prisma/
```

---

## 8. Database principles

### General

- PostgreSQL on Supabase; Prisma migrations (`migrate dev` local, `migrate deploy` prod)
- Additive migrations deploy freely; destructive changes split across deploy cycles (Ch.23)
- UUID primary keys; `timestamptz` for all timestamps
- Soft delete via `deactivated_at` where applicable

### Multi-tenancy

- **Stylist = tenant.** Every tenant-owned row has `stylist_id`.
- **Client = platform-wide** `users` record keyed by E.164 phone.
- Stylists access only bookings/conversations/clients in their scope.
- Enforced in middleware + repository layer; tested from M3 onward.

### Core entities (see Playbook for full schemas)

- `users`, `sessions` — Identity (Ch.3)
- `stylist_profiles`, `portfolio_items`, `service_offerings` — Profile (Ch.6)
- `bookings` — Booking engine (Ch.7)
- `payments`, `processed_webhook_events` — Payments (Ch.9)
- `conversations`, `messages`, `escalations` — AI + messaging (Ch.11, 13)
- `notifications` — Notifications (Ch.12)

### Pricing integrity

- `service_offerings`: structured style_name, size_tier, length_tier, base_price, estimated_duration_minutes
- Confirmed bookings **retain price at time of booking** — profile price changes apply prospectively only
- Custom styles allowed but flagged lower-confidence for AI lookup

### Data retention

| Data | Retention |
|------|-----------|
| Conversations | 12 months |
| Booking history | Indefinite |
| Portfolio images | Until stylist deletes |
| Inspiration photos | 30 days after completed appointment |
| Analytics aggregates | Indefinite |

### PII

- Encrypt phone, email at rest; access logged
- Never log PII in plaintext (redaction from Ch.1.8)
- Never send raw client text to downstream systems as executable instructions

---

## 9. AI behaviour guidelines

### Provider and orchestration

- **Anthropic Claude only** — no OpenAI, no LangGraph, no persistent agent memory frameworks
- **Stateless:** conversation in DB; full relevant context passed each turn; model does not retain state between calls
- Application code — not the model — executes all actions (book, charge, escalate)

### Structured-output discipline (Ch.13.2)

Every model turn returns validated JSON:

```typescript
{
  intent: string;
  extracted_slots: { style?, date?, time_preference?, ... };
  confidence: number;      // 0–1
  next_action: string;
}
```

**Rules:**

1. Schema validated strictly before any action
2. On validation failure: retry once with correction prompt → then escalate
3. **Never** execute actions from unvalidated or malformed output
4. Client message content is **untrusted data**, not instructions

### Never hallucinate pricing (Ch.6.4 + Ch.13.4)

1. AI extracts style intent and slots from conversation
2. Application looks up `service_offerings` deterministically
3. Model **never** invents a price — it references lookup result or escalates
4. Unrecognized/custom styles → confirm with stylist or client; do not assume
5. Price is "agreed" at hold/deposit step; stored on booking record

### Confidence and escalation (Ch.13.6)

| Rule | Value |
|------|-------|
| Global confidence threshold (Phase 1) | **0.8** |
| Below threshold | Escalate to stylist — do not guess |
| Per-stylist overrides | V2 |
| Always escalate | `dispute`, `complaint`, prompt injection attempts, out-of-scope chit-chat |
| Reuse | Ch.14 style recognition reuses `shouldEscalate` from 13.6 |

### Prompt injection resistance (Ch.13.7)

- System prompt + structured-output contract are sole source of allowed actions
- Attempts to alter pricing/policy via client text → treat as escalation case
- Never construct SQL, templates, or API calls from raw message text

### Kill switch (Ch.23.3)

- Feature flag `AI_RECEPTIONIST_ENABLED=false` → escalate all inbound to stylist
- Must be drillable before production; no full redeploy required

### SMS and cost controls

- Platform absorbs SMS during free beta
- **500 SMS/month/stylist**; soft warning at 400
- OTP and booking flows use SMS (Twilio) — not email

### STOP keyword (founder override)

- STOP on a phone number: halts **AI conversations + marketing automation**
- **Still allows** essential transactional notifications (confirmations, reminders, deposit links)
- Platform-level flag; verified end-to-end (Ch.12.4)

### Testing requirements (never ship without)

- Golden-set regression suite (13.8)
- Adversarial/injection suite (13.7)
- Escalation threshold tests (13.6)
- Human review of live escalations weekly during beta

---

## 10. Development governance

### Document hierarchy for AI sessions

1. Read this Product Blueprint
2. Read relevant Playbook chapter for the system being built
3. Read relevant Prompt Library chapter/prompt
4. Read `docs/ARCHITECTURE.md`

### Git (Back Matter §7)

- Branch per prompt: `ch7/7.2-slot-holds`
- One prompt ≈ one commit
- PR to `main`; CI must pass
- Tag at milestones: `v0.6.0-m6-ai-receptionist`

### When to start a new chat

- New chapter / new concern
- Context degradation (contradictions, forgotten signatures)
- Audit prompts (Ch.20, 9.4, etc.)

### Production gates

- Legal: privacy policy, terms, ICO, Anthropic DPA before production
- Back Matter §8 Production Readiness Checklist before M8 public launch
- Never ship Ch.13 without 13.6 + 13.7

### Chapter execution protocol (binding)

**Priorities:** maintainability, scalability, security, DX, clean architecture, type safety, testability, mobile-first design, production-ready code. No placeholder implementations unless unavoidable.

**Before each chapter:** (1) what will be built, (2) why this stage, (3) every file created/modified, (4) architectural decisions.

**After each chapter:** run tests, lint, typecheck; fix all errors; update docs in the same change. **Do not start the next chapter until the current one is complete and stable.**

**On doc conflict:** stop and explain before writing code.

---

## 11. Revision log

| Date | Change |
|------|--------|
| 2026-07-10 | Initial blueprint consolidated from stress-test, design direction, stack validation, Back Matter reconciliation |
| 2026-07-10 | MVP scope: Back Matter wins — SMS-only client channel; web surfaces + analytics V2 |
| 2026-07-10 | Supabase: Postgres + Storage (abstracted); Auth excluded |
| 2026-07-10 | Chapter execution protocol and implementation priorities added to governance |

---

*No application code until Prompt Library Ch.1 is explicitly approved.*
