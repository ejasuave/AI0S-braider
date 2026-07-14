-- Chapter 12 — Notifications completion (preferences, audit log, skip_reason)

CREATE TABLE "notification_preferences" (
  "user_id" UUID NOT NULL,
  "appointment_reminders_enabled" BOOLEAN NOT NULL DEFAULT true,
  "marketing_messages_enabled" BOOLEAN NOT NULL DEFAULT true,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "opt_out_audit_log" (
  "id" UUID NOT NULL,
  "phone_number" TEXT NOT NULL,
  "user_id" UUID,
  "action" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "keyword" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "opt_out_audit_log_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "notifications"
  ADD COLUMN "skip_reason" TEXT,
  ADD COLUMN "deposit_disposition" TEXT;

ALTER TABLE "notifications"
  ALTER COLUMN "booking_id" DROP NOT NULL;

CREATE INDEX "opt_out_audit_log_phone_number_created_at_idx"
  ON "opt_out_audit_log"("phone_number", "created_at");

CREATE INDEX "opt_out_audit_log_user_id_created_at_idx"
  ON "opt_out_audit_log"("user_id", "created_at");

ALTER TABLE "notification_preferences"
  ADD CONSTRAINT "notification_preferences_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "opt_out_audit_log"
  ADD CONSTRAINT "opt_out_audit_log_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
