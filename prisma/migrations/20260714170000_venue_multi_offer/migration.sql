-- Multi-select venue offers on business (client picks one per booking)

ALTER TABLE "businesses"
  ADD COLUMN "offers_stylist_location" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "offers_come_to_client" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "offers_remote" BOOLEAN NOT NULL DEFAULT false;

UPDATE "businesses"
SET
  "offers_stylist_location" = ("service_venue_mode" = 'stylist_location'),
  "offers_come_to_client" = ("service_venue_mode" = 'come_to_client'),
  "offers_remote" = ("service_venue_mode" = 'remote');

-- Keep at least one offer if a row somehow had an unexpected enum value
UPDATE "businesses"
SET "offers_stylist_location" = true
WHERE NOT "offers_stylist_location"
  AND NOT "offers_come_to_client"
  AND NOT "offers_remote";

ALTER TABLE "businesses" DROP COLUMN "service_venue_mode";
