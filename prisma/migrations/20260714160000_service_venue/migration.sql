-- Service venue defaults (stylist business) + booking snapshots

CREATE TYPE "service_venue_mode" AS ENUM ('remote', 'stylist_location', 'come_to_client');

ALTER TABLE "businesses"
  ADD COLUMN "service_venue_mode" "service_venue_mode" NOT NULL DEFAULT 'stylist_location',
  ADD COLUMN "workplace_address" TEXT,
  ADD COLUMN "home_visit_surcharge" DECIMAL(10, 2);

ALTER TABLE "bookings"
  ADD COLUMN "service_venue_mode" "service_venue_mode" NOT NULL DEFAULT 'stylist_location',
  ADD COLUMN "venue_address" TEXT,
  ADD COLUMN "home_visit_surcharge" DECIMAL(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN "client_display_name" TEXT;
