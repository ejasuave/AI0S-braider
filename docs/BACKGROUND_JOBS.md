# Background Jobs — Project Braids

**Chapter:** 2.5  
**Last updated:** 2026-07-20

## Overview

Asynchronous work uses **BullMQ** on Redis (`REDIS_URL`). The API enqueues jobs; a **separate worker process** consumes them.

| Process    | Entry                    | Command / host                                 |
| ---------- | ------------------------ | ---------------------------------------------- |
| API server | `apps/api/src/server.ts` | `pnpm dev` (api package) / Fly `*-api-staging` |
| Worker     | `apps/api/src/worker.ts` | `pnpm worker:dev` / Fly `*-worker-staging`     |

Staging worker: `fly deploy --config fly.worker.staging.toml -a project-braids-worker-staging`. If Upstash hits its free-tier command limit, stop the worker until Redis is healthy again — see [STAGING_SETUP.md](./STAGING_SETUP.md) §2. Auth and invite flows do not depend on the worker.

## Shared queue module

- **Connection:** `apps/api/src/lib/queue.ts` — `getSystemQueue()`, `createSystemWorker()`, `scheduleRecurringJobs()`
- **Do not** create ad-hoc Queue instances in feature modules

## Where jobs live

Job **definitions** belong in the **owning feature module** (Ch.2.1 boundaries):

| Job                      | Owner                 | Handler file                      |
| ------------------------ | --------------------- | --------------------------------- |
| `system.heartbeat`       | System (Ch.2 example) | `jobs/system-heartbeat.job.ts`    |
| `system.example-ping`    | System (Ch.2 example) | `jobs/example-ping.job.ts`        |
| `system.example-delayed` | System (Ch.2 example) | `jobs/example-delayed.job.ts`     |
| `booking.expire-hold`    | Booking               | `jobs/booking-expire-hold.job.ts` |
| `notifications.*`        | Notifications         | `jobs/notification-sweep.job.ts`  |

Register new job names in `JOB_NAMES` inside `lib/queue.ts` and add a `case` in `createSystemWorker()`.

## Recurring vs on-demand

### Recurring (cron-style)

Scheduled in `scheduleRecurringJobs()` when the worker starts:

```typescript
await queue.add(
  JOB_NAMES.SYSTEM_HEARTBEAT,
  {},
  {
    repeat: { every: 60_000 },
    jobId: 'recurring-system-heartbeat',
  },
);
```

**Verify:** run `pnpm worker:dev` — `Worker heartbeat` log line approximately every 60 seconds.

### On-demand with delay

Enqueued from API routes with `delay` (ms):

```typescript
await queue.add(JOB_NAMES.EXAMPLE_DELAYED, { message: 'hello' }, { delay: 3000 });
```

**Proof endpoint:** `POST /api/v1/system/example-delayed-job` with `{ "message": "test", "delayMs": 3000 }`.

**Verify:** job logs after the delay, not immediately.

### On-demand immediate

```typescript
await queue.add(JOB_NAMES.EXAMPLE_PING, { message: 'chapter-2-example' });
```

**Proof endpoint:** `POST /api/v1/system/example-job`

## Idempotency

All job handlers must be **safe to retry** — BullMQ may redeliver on failure. Use idempotent DB operations or check current state before mutating.

## Adding a new job

1. Add `JOB_NAMES.YOUR_JOB = 'module.action'` in `lib/queue.ts`
2. Create handler in `apps/api/src/jobs/` or `modules/<feature>/jobs/`
3. Add `case` in `createSystemWorker()` switch
4. Enqueue from the owning module's service layer (not from routes directly when avoidable)
5. Document the job in this file

## Local development

Redis must be running (`pnpm infra:up`). Without Redis, enqueue endpoints return `503 SERVICE_UNAVAILABLE` and the worker logs a warning.
