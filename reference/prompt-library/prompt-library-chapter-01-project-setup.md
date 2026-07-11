# Chapter 1 — Project Setup

## Overview

This chapter establishes everything every later chapter will assume already exists: the repository structure, language/tooling conventions, environment and secrets handling, database connection, CI skeleton, module conventions, local dev environment, and baseline observability. No feature work should begin before this chapter is complete — every prompt in Chapters 2 onward is written assuming these foundations are already in place and will explicitly reference them.

## Why This Chapter Exists

AI coding assistants produce dramatically better output when the surrounding project already has clear conventions to follow. Without this chapter, every subsequent prompt would need to re-specify folder structure, naming conventions, and tooling choices — leading to inconsistency as different chat sessions make different assumptions. This chapter exists to be run once, early, so that it becomes shared context every later prompt can simply reference ("following the conventions established in Chapter 1...") rather than re-derive.

## Prompts in This Chapter

1.1 Initialize monorepo/project structure
1.2 Configure TypeScript, linting, and formatting standards
1.3 Set up environment variable management and secrets strategy
1.4 Configure the primary database and ORM
1.5 Set up CI pipeline skeleton
1.6 Establish folder/module conventions for frontend and backend
1.7 Configure local development environment
1.8 Set up error tracking and logging baseline

---

### Prompt 1.1 — Initialize Monorepo/Project Structure

**Category:** Project Setup — Foundation
**Objective:** Create the top-level repository structure that will house the frontend application, backend API, shared types/schemas, and infrastructure configuration, using a monorepo approach so that shared types (e.g., booking status enums, API response shapes) never drift between frontend and backend.

**Context:** This is the first prompt in the entire build. Nothing exists yet. This prompt assumes only that you have chosen a package manager and monorepo tool (this prompt uses pnpm workspaces + Turborepo as the reference choice, since both Claude Code and Cursor handle this tooling well; substitute Nx or Yarn workspaces if your team prefers, but stay consistent for the rest of the build once chosen).

**Prompt:**

```
Set up a new monorepo for a SaaS platform called [Platform Name] using pnpm workspaces and Turborepo.

Create the following top-level structure:
- /apps/web — the customer- and stylist-facing frontend application (Next.js, TypeScript)
- /apps/api — the backend API service (Node.js, TypeScript, Express or Fastify — choose Fastify for performance)
- /packages/shared-types — shared TypeScript types and Zod schemas used by both apps/web and apps/api
- /packages/config — shared ESLint, TypeScript, and Prettier configuration
- /infrastructure — infrastructure-as-code and deployment configuration (placeholder for now)

Requirements:
- Root package.json with workspace configuration for pnpm
- turbo.json with pipeline definitions for build, lint, test, and dev tasks
- Each app/package must have its own package.json with correct workspace-relative dependencies
- A root README.md explaining the repository structure and how to run each app locally
- A root .gitignore appropriate for a Node/TypeScript monorepo (node_modules, .env, build artifacts, etc.)
- Do not add any feature code yet — this prompt is structural only

Do not use npm or yarn — use pnpm exclusively for this project going forward.
```

**Expected Output:** A committed repository skeleton with the five top-level directories listed above, each containing a minimal valid package.json, a working turbo.json, root-level tooling config files, and a README describing the structure. Running `pnpm install` at the root should succeed with no errors, even though apps/web and apps/api contain no real application code yet.

**Success Criteria:**

- `pnpm install` completes without errors from a clean clone
- `pnpm turbo run build` executes (even if it does nothing meaningful yet) without configuration errors
- Repository structure matches the specification exactly — no extra top-level directories invented by the assistant
- README accurately describes the structure that was actually created

**Dependencies:** None — this is the first prompt in the build.

---

### Prompt 1.2 — Configure TypeScript, Linting, and Formatting Standards

**Category:** Project Setup — Tooling
**Objective:** Establish a single, shared set of TypeScript, ESLint, and Prettier configurations in `packages/config` that both `apps/web` and `apps/api` extend, so code style and type-safety rules are enforced identically across the entire codebase.

**Context:** Requires Prompt 1.1 completed (monorepo structure exists). This prompt should be run in the same or a closely related session, since it directly builds on the folder structure just created.

**Prompt:**

```
Using the existing monorepo structure in packages/config, apps/web, and apps/api, configure shared TypeScript, ESLint, and Prettier standards.

Requirements:
- packages/config should export a base tsconfig.json (strict mode enabled, no implicit any, consistent module resolution) that apps/web and apps/api each extend with their own app-specific overrides only where necessary (e.g., JSX settings for apps/web)
- packages/config should export a shared ESLint configuration enforcing: no unused variables, no implicit any, consistent import ordering, no default exports for non-page/component files, and enforced naming conventions (camelCase for variables/functions, PascalCase for types/components)
- packages/config should export a shared Prettier configuration (single quotes, trailing commas, 2-space indentation — adjust only if the existing repo already establishes a different convention)
- Add lint and typecheck scripts to the root package.json that run across all workspaces via Turborepo
- Add a pre-commit hook (using husky or simple-git-hooks) that runs lint and typecheck on staged files before allowing a commit
- Do not modify any application logic — this prompt is tooling configuration only

After making these changes, run the lint and typecheck commands and fix any issues that surface in the existing skeleton code so the repository is in a clean, passing state.
```

**Expected Output:** Shared config files in `packages/config`, extended (not duplicated) by `apps/web` and `apps/api`. Root-level `lint` and `typecheck` scripts that pass cleanly. A working pre-commit hook.

**Success Criteria:**

- `pnpm lint` and `pnpm typecheck` both exit with code 0 from a clean state
- A staged file with a deliberately introduced lint violation is blocked by the pre-commit hook
- No configuration is duplicated between apps/web and apps/api — both extend the shared package

**Dependencies:** Prompt 1.1

---

### Prompt 1.3 — Set Up Environment Variable Management and Secrets Strategy

**Category:** Project Setup — Configuration
**Objective:** Establish a consistent, type-safe pattern for environment variables across both apps, with a clear separation between local development values, staging, and production secrets, and validation that fails fast if required variables are missing.

**Context:** Requires Prompt 1.1. Should be run before any feature work that requires external credentials (database URL, Stripe keys, Twilio credentials, AI model API keys), since every later chapter's prompts will assume this pattern exists and will simply say "add the required environment variables following the established pattern."

**Prompt:**

```
Set up environment variable management for both apps/web and apps/api.

Requirements:
- Create a .env.example file at the root of apps/api and apps/web listing every environment variable that will eventually be needed, with placeholder values and comments explaining each one (grouped by category: Database, Auth, Stripe, Twilio, AI Provider, Third-party integrations)
- Implement a runtime validation layer (using Zod) in apps/api that validates all required environment variables are present and correctly typed at application startup, and throws a clear, descriptive error immediately on boot if any are missing or malformed — the app should never start in a broken state
- Implement the equivalent validation for apps/web's public/server environment variables, respecting the frontend framework's distinction between server-only and client-exposed variables
- Document in the README how local developers should obtain a working .env file (e.g., copying .env.example and filling in sandbox/test credentials) and explicitly state that real production secrets must never be committed to the repository
- Add .env and .env.local to .gitignore if not already present

Do not add actual secret values anywhere in the repository, including in this prompt's output — only placeholders and documentation.
```

**Expected Output:** `.env.example` files with clearly categorized placeholder variables, a Zod-based (or equivalent) startup validation module in the API, equivalent validation in the frontend app, and updated documentation.

**Success Criteria:**

- Starting `apps/api` with a required variable missing produces an immediate, clear startup error rather than a runtime crash later
- `.env` files are confirmed absent from git history/tracked files
- `.env.example` is comprehensive enough that a new developer can create a working local environment without asking a teammate what variables are needed

**Dependencies:** Prompt 1.1

---

### Prompt 1.4 — Configure the Primary Database and ORM

**Category:** Project Setup — Data Layer
**Objective:** Stand up the primary Postgres database connection and ORM/query layer that every future chapter's database prompts will build schema on top of, including the migration tooling convention that will be used for the life of the project.

**Context:** Requires Prompts 1.1 and 1.3 (environment variable pattern must exist so the database connection string can be validated at startup). This prompt does not create any feature tables — it only establishes the connection, ORM configuration, and migration workflow. Chapter 3 (Authentication) will be the first chapter to actually add schema.

**Prompt:**

```
Set up the primary database connection and ORM for apps/api using PostgreSQL and Prisma (substitute Drizzle if the team has already chosen it — do not use both).

Requirements:
- Configure the Prisma schema file with the connection using the DATABASE_URL environment variable established in the previous environment configuration prompt
- Set up the migration workflow (prisma migrate dev for local, prisma migrate deploy for production) and document it in the README
- Create a database client singleton module that apps/api uses everywhere it needs database access — do not allow ad-hoc PrismaClient instantiation scattered across the codebase, since this causes connection pool exhaustion
- Add a health-check endpoint (GET /health/db) that performs a trivial query to confirm database connectivity, to be used by infrastructure monitoring later
- Do not create any feature-specific tables yet (no users, bookings, etc.) — this prompt only establishes the connection and tooling. The schema file should be otherwise empty aside from the generator/datasource configuration
- Add a seed script scaffold (prisma/seed.ts) that currently does nothing but is wired into the workflow so future chapters can add seed data for local development

Verify the setup by running a migration against a local database and confirming the health-check endpoint returns success.
```

**Expected Output:** A working Prisma (or Drizzle) configuration connected to a local Postgres instance, a documented migration workflow, a singleton database client module, a working `/health/db` endpoint, and an empty seed script scaffold.

**Success Criteria:**

- `prisma migrate dev` runs successfully against a local database with zero schema (or only the tooling's own metadata tables)
- `GET /health/db` returns a 200 response confirming connectivity
- Searching the codebase confirms only one place instantiates the database client
- README accurately documents how to run migrations locally and in CI/production

**Dependencies:** Prompts 1.1, 1.3

---

### Prompt 1.5 — Set Up CI Pipeline Skeleton

**Category:** Project Setup — Continuous Integration
**Objective:** Establish a CI pipeline (GitHub Actions as the reference choice) that runs lint, typecheck, and test tasks on every pull request, so that no later chapter's code can be merged without passing these baseline checks.

**Context:** Requires Prompts 1.1 and 1.2 (lint/typecheck scripts must already exist to be invoked by CI). Requires Prompt 1.4 if any CI job needs a database instance for tests (a test database service should be provisioned in the CI job itself, separate from local development).

**Prompt:**

```
Set up a GitHub Actions CI pipeline for this monorepo.

Requirements:
- Trigger on every pull request and on pushes to the main branch
- Use pnpm with dependency caching to keep pipeline runs fast
- Run three jobs in parallel where possible: lint, typecheck, and test — using the existing root-level scripts established in earlier prompts
- The test job should spin up a temporary Postgres service container and run any existing tests against it (there may be very few or no tests yet at this stage — that is expected; the pipeline should still be correctly configured to run them as they are added in later chapters)
- Fail the pipeline clearly and specifically if any job fails — do not swallow errors or continue on failure
- Add a status badge to the root README reflecting the CI pipeline status
- Do not set up deployment steps yet — this prompt is CI (lint/typecheck/test) only; deployment is covered in Chapter 23
```

**Expected Output:** A `.github/workflows/ci.yml` file implementing the three parallel jobs described, a working Postgres service container configuration for the test job, and a status badge in the README.

**Success Criteria:**

- Opening a test pull request triggers the pipeline and all three jobs run
- A deliberately broken lint rule or type error in a test PR causes the corresponding job to fail visibly
- The test job successfully connects to its ephemeral Postgres container

**Dependencies:** Prompts 1.1, 1.2, 1.4

---

### Prompt 1.6 — Establish Folder/Module Conventions for Frontend and Backend

**Category:** Project Setup — Conventions
**Objective:** Define and document the internal folder structure within `apps/web` and `apps/api` that every future feature prompt will be instructed to follow, so that features added by different chat sessions over months or years land in predictable, consistent locations.

**Context:** Requires Prompt 1.1. This prompt is primarily documentation plus a minimal scaffold — it does not need to wait for the database or CI setup, but is listed after them here because it references the app structure created in 1.1 and is most useful once the repo is otherwise stable.

**Prompt:**

```
Establish and document the internal folder conventions for apps/web and apps/api that all future feature work must follow.

For apps/api, establish a feature-module structure, for example:
- src/modules/<feature>/routes.ts — route definitions for that feature
- src/modules/<feature>/service.ts — business logic
- src/modules/<feature>/repository.ts — database access for that feature
- src/modules/<feature>/schema.ts — Zod validation schemas for that feature's inputs/outputs
- src/modules/<feature>/<feature>.test.ts — tests colocated with the feature
- src/shared/ — cross-cutting utilities, middleware, and the database client singleton

For apps/web, establish a structure such as:
- src/app/ (or pages/, depending on the framework's routing convention) — route-level components only, kept thin
- src/features/<feature>/components/ — feature-specific UI components
- src/features/<feature>/hooks/ — feature-specific data-fetching and state hooks
- src/shared/components/ — cross-feature reusable UI components
- src/shared/lib/ — cross-cutting utilities

Requirements:
- Create this structure as an actual scaffold (empty or near-empty placeholder files with comments) so it is not just documentation but an enforced starting point
- Write a CONTRIBUTING.md documenting this structure with a brief explanation of where a new feature's files should go, using one worked example (e.g., "if building a new 'reviews' feature, files land in modules/reviews and features/reviews respectively")
- Do not implement any real feature logic in this prompt — only the folder scaffold and documentation
```

**Expected Output:** A scaffolded module structure in both apps, currently empty or containing only placeholder/example files, plus a CONTRIBUTING.md explaining the convention with a worked example.

**Success Criteria:**

- The scaffold structure is present and matches the specification
- CONTRIBUTING.md is clear enough that a prompt in a later chapter can simply say "add this feature following the module conventions in CONTRIBUTING.md" without re-explaining the structure
- No feature logic has leaked into this prompt's output

**Dependencies:** Prompt 1.1

---

### Prompt 1.7 — Configure Local Development Environment

**Category:** Project Setup — Developer Experience
**Objective:** Make it possible for a new engineer (or a fresh Claude Code / Cursor session with no prior context) to get the full stack running locally with a single documented command sequence.

**Context:** Requires Prompts 1.1, 1.3, and 1.4 (project structure, environment variables, and database must all already be configured for this prompt to wire them together into a working local environment).

**Prompt:**

```
Set up a Docker Compose configuration for local development that runs:
- A Postgres database service matching the configuration expected by the Prisma/ORM setup
- Any other local infrastructure dependencies needed at this stage (e.g., a local Redis instance if background job queuing will use it — include it now even if unused yet, since later chapters will assume it exists)

Requirements:
- docker-compose.yml at the repository root, with named volumes so data persists across restarts
- A documented single-command local startup sequence in the README: e.g., "docker compose up -d, then pnpm install, then pnpm prisma migrate dev, then pnpm turbo run dev"
- apps/web and apps/api should run via their existing dev scripts (not inside Docker themselves, to preserve fast hot-reload) while only their infrastructure dependencies (database, redis) run in Docker
- Confirm the .env.example values are compatible with the Docker Compose service hostnames/ports
- Add a troubleshooting section to the README covering the most likely local setup failures (port conflicts, stale Docker volumes, missing .env file)

Verify by tearing down and rebuilding the full local environment from a clean clone and confirming apps/web and apps/api both start successfully and can reach the database.
```

**Expected Output:** A working `docker-compose.yml`, an updated README with a clear step-by-step local setup sequence and troubleshooting section, and confirmation that a clean-clone setup succeeds end to end.

**Success Criteria:**

- A fresh clone of the repository can be brought to a fully running local state by following only the README instructions, with no undocumented steps
- `docker compose up -d` starts all required infrastructure services without port conflicts
- apps/api's `/health/db` endpoint (from Prompt 1.4) returns success when run against the Docker Compose database

**Dependencies:** Prompts 1.1, 1.3, 1.4

---

### Prompt 1.8 — Set Up Error Tracking and Logging Baseline

**Category:** Project Setup — Observability
**Objective:** Establish structured logging and error tracking from day one, so that every feature built in every later chapter automatically benefits from consistent, queryable logs and captured exceptions rather than this being retrofitted later.

**Context:** Requires Prompts 1.1 and 1.3 (environment variables must support an error-tracking provider API key/DSN). This is the last prompt in Chapter 1 and marks the point at which the project has a genuinely production-grade foundation, even though no features exist yet.

**Prompt:**

```
Set up structured logging and error tracking for apps/api and apps/web.

Requirements:
- Integrate a structured logging library (e.g., Pino for apps/api) that outputs JSON logs in production and human-readable logs in local development, with a consistent log level convention (debug, info, warn, error)
- Every request handled by apps/api should produce a request log entry including method, path, status code, duration, and a request ID that is generated if not already present in an incoming header, so individual requests can be traced end to end
- Integrate an error tracking provider (e.g., Sentry) for both apps/web and apps/api, using the environment variable pattern already established, with a graceful no-op fallback in local development if no DSN is configured
- Ensure no PII (raw phone numbers, card details, full names in some contexts) is logged in plaintext by default — establish a redaction convention now (e.g., a logging utility that automatically masks known-sensitive field names) since this is far harder to retrofit after many features already log freely
- Document logging conventions in CONTRIBUTING.md: what should be logged at each level, and the redaction rule for sensitive fields

Verify by triggering a deliberate error in a test endpoint and confirming it is captured by the error tracking provider with a useful stack trace and request context.
```

**Expected Output:** Structured logging wired into both apps, an error-tracking integration with graceful local fallback, a documented redaction convention, and confirmation that a deliberate error is captured correctly.

**Success Criteria:**

- A request to any endpoint produces a structured log line with method, path, status, duration, and request ID
- A deliberately thrown error in a test route appears in the error-tracking provider's dashboard (or local no-op log) with full context
- A log statement containing a known-sensitive field name (e.g., `phone_number`) is automatically redacted in output, verified by an explicit test

**Dependencies:** Prompts 1.1, 1.3

---

## Chapter 1 Summary

At the end of this chapter, the repository has: a structured monorepo, shared tooling and type-safety enforcement, a validated environment variable system, a connected database with a migration workflow, a working CI pipeline, documented module conventions, a one-command local dev environment, and baseline structured logging with error tracking and PII redaction. No feature code exists yet — that begins in Chapter 2 (Architecture), which layers service-boundary and API conventions on top of this foundation, and Chapter 3 (Authentication), which is the first chapter to add real schema and business logic.

**Do not proceed to feature work (Chapter 3 onward) until every prompt in this chapter has been run and its success criteria verified.** Skipping or partially completing this chapter is the single most common cause of inconsistent output in later chapters, since every later prompt assumes these conventions are already established and enforced.

---

Ready to proceed to Chapter 2 (Architecture) when you are.
