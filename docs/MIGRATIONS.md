# Database migrations (Chapter 23.4)

Prisma migrations in `prisma/migrations/` are the single source of schema truth.

## Rules

1. **Additive changes deploy freely** — new tables, new nullable columns, new indexes.
2. **Destructive changes use expand/contract** — never drop or rename in one deploy:
   - **Expand:** add new column/table; dual-write if needed
   - **Migrate:** backfill data
   - **Contract:** remove old column/table in a **later** deploy
3. **Run migrations before app instances** — new code may depend on new schema.
4. **Never `prisma migrate reset` in staging or production** — dev only.

## Deploy command

```bash
# Checks for destructive SQL, then applies pending migrations
pnpm ops:migrate-deploy
```

Equivalent to:

```bash
bash scripts/ops/check-migrations.sh
pnpm db:migrate:deploy
```

Set `DATABASE_URL` to the **target environment** before running.

## Safety check

`scripts/ops/check-migrations.sh` scans `migration.sql` files for:

- `DROP TABLE`
- `DROP COLUMN`
- `ALTER COLUMN … TYPE`
- `RENAME TO`

If found, the script **fails** and requires explicit review. Override only when the expand/contract sequence is documented in the PR.

## CI integration

- `ci.yml` runs `check-migrations` on every PR
- `deploy-staging.yml` and `deploy-production.yml` run it before deploy gates

## Failed migration recovery

1. **Do not** run `migrate reset` on shared environments.
2. Inspect `_prisma_migrations` table for failed entries.
3. Fix forward with a corrective migration or manual SQL (with backup).
4. Restore from backup only for catastrophic failure — test restores quarterly.

## Rollback and schema

Application rollback does **not** roll back schema. If a deploy introduced a bad migration:

- Deploy previous **application** code that tolerates current schema, or
- Ship a forward migration that reverts the change

## Local development

```bash
pnpm db:migrate        # prisma migrate dev — creates migration + applies locally
pnpm db:migrate:deploy # production-style apply (CI/staging/prod)
```

After pulling `main`, always:

```bash
pnpm db:migrate:deploy
```

## References

- [DEPLOYMENT.md](./DEPLOYMENT.md) — full deploy sequence
- Back Matter §7 — database workflow for the life of the project
- Blueprint — additive-first migration policy
