-- Chapter 8: Calendar & Availability

ALTER TABLE "stylist_profiles" ALTER COLUMN "buffer_minutes" SET DEFAULT 15;

CREATE TYPE "external_calendar_provider" AS ENUM ('google');
CREATE TYPE "external_calendar_sync_status" AS ENUM ('synced', 'pending', 'failed');

CREATE TABLE "calendar_connections" (
    "business_id" UUID NOT NULL,
    "provider" "external_calendar_provider" NOT NULL DEFAULT 'google',
    "refresh_token_enc" TEXT NOT NULL,
    "access_token_enc" TEXT,
    "token_expires_at" TIMESTAMPTZ(6),
    "calendar_id" TEXT NOT NULL DEFAULT 'primary',
    "channel_id" TEXT,
    "channel_resource_id" TEXT,
    "subscription_expires_at" TIMESTAMPTZ(6),
    "connected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "calendar_connections_pkey" PRIMARY KEY ("business_id")
);

CREATE TABLE "external_calendar_links" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "provider" "external_calendar_provider" NOT NULL DEFAULT 'google',
    "external_event_id" TEXT NOT NULL,
    "booking_id" UUID,
    "sync_status" "external_calendar_sync_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "external_calendar_links_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "external_calendar_links_business_id_provider_external_event_id_key"
    ON "external_calendar_links"("business_id", "provider", "external_event_id");
CREATE INDEX "external_calendar_links_business_id_booking_id_idx"
    ON "external_calendar_links"("business_id", "booking_id");

ALTER TABLE "calendar_connections"
    ADD CONSTRAINT "calendar_connections_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "external_calendar_links"
    ADD CONSTRAINT "external_calendar_links_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "external_calendar_links"
    ADD CONSTRAINT "external_calendar_links_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
