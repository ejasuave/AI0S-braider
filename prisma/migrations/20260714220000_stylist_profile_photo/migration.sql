-- Stylist headshot for client-facing directory / booking pages

ALTER TABLE "stylist_profiles"
  ADD COLUMN "photo_url" TEXT,
  ADD COLUMN "photo_storage_key" TEXT;
