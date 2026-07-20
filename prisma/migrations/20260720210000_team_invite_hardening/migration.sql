-- Phase 1 team invite hardening: role presets, secure tokens, deactivate

CREATE TYPE "business_staff_role" AS ENUM ('manager', 'stylist', 'receptionist');

ALTER TABLE "business_staff"
  ADD COLUMN "display_name" TEXT,
  ADD COLUMN "role" "business_staff_role" NOT NULL DEFAULT 'stylist',
  ADD COLUMN "invite_token_hash" TEXT,
  ADD COLUMN "invite_expires_at" TIMESTAMPTZ(6),
  ADD COLUMN "deactivated_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX "business_staff_invite_token_hash_key" ON "business_staff"("invite_token_hash");
