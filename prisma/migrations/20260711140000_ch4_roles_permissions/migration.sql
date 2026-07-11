-- Ch.4: businesses, business_staff, impersonation_sessions

CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "business_name" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "businesses_owner_user_id_key" ON "businesses"("owner_user_id");

ALTER TABLE "businesses" ADD CONSTRAINT "businesses_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "business_staff" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "user_id" UUID,
    "invitee_email" TEXT,
    "invitee_phone" TEXT,
    "permissions" JSONB NOT NULL,
    "invited_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMPTZ(6),
    "removed_at" TIMESTAMPTZ(6),

    CONSTRAINT "business_staff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "business_staff_business_id_removed_at_idx" ON "business_staff"("business_id", "removed_at");
CREATE INDEX "business_staff_user_id_idx" ON "business_staff"("user_id");

ALTER TABLE "business_staff" ADD CONSTRAINT "business_staff_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "business_staff" ADD CONSTRAINT "business_staff_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "impersonation_sessions" (
    "id" UUID NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "target_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),
    "created_from_ip" TEXT NOT NULL,

    CONSTRAINT "impersonation_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "impersonation_sessions_admin_user_id_started_at_idx" ON "impersonation_sessions"("admin_user_id", "started_at");
CREATE INDEX "impersonation_sessions_target_user_id_idx" ON "impersonation_sessions"("target_user_id");

ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "impersonation_sessions" ADD CONSTRAINT "impersonation_sessions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stylist_profiles" ADD COLUMN "business_id" UUID;

CREATE UNIQUE INDEX "stylist_profiles_business_id_key" ON "stylist_profiles"("business_id");

ALTER TABLE "stylist_profiles" ADD CONSTRAINT "stylist_profiles_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill businesses for existing stylist owners
INSERT INTO "businesses" ("id", "owner_user_id", "business_name", "created_at")
SELECT gen_random_uuid(), sp."user_id", sp."business_name", sp."created_at"
FROM "stylist_profiles" sp
WHERE NOT EXISTS (
    SELECT 1 FROM "businesses" b WHERE b."owner_user_id" = sp."user_id"
);

UPDATE "stylist_profiles" sp
SET "business_id" = b."id"
FROM "businesses" b
WHERE b."owner_user_id" = sp."user_id" AND sp."business_id" IS NULL;
