ALTER TABLE "stylist_profiles"
  ADD COLUMN "directory_visible" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "stylist_profiles_directory_visible_idx"
  ON "stylist_profiles"("directory_visible")
  WHERE "directory_visible" = true;
