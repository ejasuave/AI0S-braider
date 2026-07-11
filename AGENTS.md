# Project Braids — Agent Onboarding

AI receptionist and operating system for independent UK hair braiders and hairstylists.

## Before writing code

1. [reference/requirements/product-blueprint.md](reference/requirements/product-blueprint.md) — **start here**
2. Relevant [Engineering Playbook](reference/requirements/engineering-playbook.md) chapter
3. [Prompt Library](reference/prompt-library/) outline + back matter for build order
4. `docs/ARCHITECTURE.md` — service boundaries (Ch.2); canonical file: [ARCHITECTURE.md](ARCHITECTURE.md) at repo root

Read every relevant document **completely** before making changes.

## Locked stack

- **Frontend:** Next.js, TypeScript, Tailwind, shadcn/ui, TanStack Query — mobile-first responsive web
- **Backend:** Fastify, TypeScript — all business logic here
- **DB:** Supabase Postgres + Prisma (not Supabase Auth)
- **Storage:** Supabase Storage via `StorageProvider` abstraction
- **AI:** Anthropic Claude only, stateless — no OpenAI, no LangGraph
- **Payments:** Stripe Connect
- **Messaging:** Twilio SMS (MVP); WhatsApp V2

## Non-negotiables

- Never hallucinate pricing — lookup `service_offerings`, escalate below 0.8 confidence
- Tool before marketplace — full directory is Ch.16 V2; **beta opt-in directory** at `/directory` for pilot
- API-first — no Server Actions as canonical write path; native apps later
- Idempotent webhooks and messaging retries
- Flag doc conflicts explicitly; never silently override Blueprint
- No placeholder implementations unless unavoidable

## Implementation priorities

Maintainability · scalability · security · developer experience · clean architecture · type safety · testability · mobile-first responsive design · production-ready code.

## Chapter execution protocol

### Before each chapter

1. **What** will be built
2. **Why** it belongs at this stage (Back Matter build order)
3. **Every file** created or modified
4. **Architectural decisions**

### After each chapter

- Run all tests, lint (`pnpm lint`), typecheck (`pnpm typecheck`)
- Fix every error before continuing
- Update documentation in the same change if behaviour changed
- Verify prompt Success Criteria line by line

**Never start the next chapter until the current one is complete and stable.**

On doc conflict: **stop and explain** before writing code.

## MVP scope

SMS-only client channel. Dashboard + onboarding web UI. Beta directory at `/directory` (opt-in). Direct booking link (`/book?…`) still supported. Embeddable web widget remains V2.

## Current phase

**Chapters 1–25 complete** — MVP build + future-feature registry documented. **Next:** beta ship checklist or a Ch.25 item when its trigger is met ([FUTURE_FEATURES.md](docs/FUTURE_FEATURES.md)).
