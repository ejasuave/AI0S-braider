-- Chapter 12 — Notifications

CREATE TYPE "notification_type" AS ENUM (
  'reminder_48h',
  'reminder_2h',
  'confirmation',
  'cancellation',
  'no_show_notice'
);

CREATE TYPE "notification_status" AS ENUM (
  'scheduled',
  'sent',
  'failed',
  'skipped',
  'cancelled'
);

CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "recipient_id" UUID NOT NULL,
  "type" "notification_type" NOT NULL,
  "status" "notification_status" NOT NULL DEFAULT 'scheduled',
  "scheduled_for" TIMESTAMPTZ(6),
  "sent_at" TIMESTAMPTZ(6),
  "failure_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sms_preferences" (
  "phone_number" TEXT NOT NULL,
  "ai_opted_out" BOOLEAN NOT NULL DEFAULT false,
  "marketing_opted_out" BOOLEAN NOT NULL DEFAULT false,
  "opted_out_at" TIMESTAMPTZ(6),
  "opted_in_at" TIMESTAMPTZ(6),
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "sms_preferences_pkey" PRIMARY KEY ("phone_number")
);

CREATE UNIQUE INDEX "notifications_booking_id_recipient_id_type_key"
  ON "notifications"("booking_id", "recipient_id", "type");

CREATE INDEX "notifications_status_scheduled_for_idx"
  ON "notifications"("status", "scheduled_for");

CREATE INDEX "notifications_booking_id_idx"
  ON "notifications"("booking_id");

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_recipient_id_fkey"
  FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
