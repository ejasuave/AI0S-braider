-- Ch.7 — nullable manual-booking FKs + calendar_conflicts for external sync

CREATE TYPE "calendar_conflict_resolution" AS ENUM (
  'kept_platform_booking',
  'kept_external_event',
  'manual_other'
);

ALTER TABLE "bookings" ALTER COLUMN "client_id" DROP NOT NULL;
ALTER TABLE "bookings" ALTER COLUMN "service_offering_id" DROP NOT NULL;

CREATE TABLE "calendar_conflicts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "business_id" UUID NOT NULL,
  "booking_id" UUID,
  "external_event_id" TEXT NOT NULL,
  "detected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(6),
  "resolution" "calendar_conflict_resolution",

  CONSTRAINT "calendar_conflicts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "calendar_conflicts_business_id_resolved_at_idx"
  ON "calendar_conflicts"("business_id", "resolved_at");

ALTER TABLE "calendar_conflicts"
  ADD CONSTRAINT "calendar_conflicts_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "calendar_conflicts"
  ADD CONSTRAINT "calendar_conflicts_booking_id_fkey"
  FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
