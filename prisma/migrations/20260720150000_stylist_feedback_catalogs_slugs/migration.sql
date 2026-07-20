-- Stylist feedback: vanity slugs, Google Reviews placeholders, hierarchical taxonomy,
-- addon catalog keys, expanded remaining balance methods.

-- Expand remaining_balance_method enum (additive).
ALTER TYPE "remaining_balance_method" ADD VALUE IF NOT EXISTS 'bank_transfer';
ALTER TYPE "remaining_balance_method" ADD VALUE IF NOT EXISTS 'cash_or_bank_transfer';
ALTER TYPE "remaining_balance_method" ADD VALUE IF NOT EXISTS 'card_or_bank_transfer';
ALTER TYPE "remaining_balance_method" ADD VALUE IF NOT EXISTS 'any';

-- Stylist profile: public slug + Google placeholders
ALTER TABLE "stylist_profiles"
  ADD COLUMN IF NOT EXISTS "public_slug" TEXT,
  ADD COLUMN IF NOT EXISTS "google_place_id" TEXT,
  ADD COLUMN IF NOT EXISTS "google_business_profile_url" TEXT,
  ADD COLUMN IF NOT EXISTS "google_reviews_linked_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX IF NOT EXISTS "stylist_profiles_public_slug_key" ON "stylist_profiles"("public_slug");

-- Service addons: catalog key
ALTER TABLE "service_addons"
  ADD COLUMN IF NOT EXISTS "catalog_key" TEXT;

-- Style categories: hierarchy
ALTER TABLE "style_categories"
  ADD COLUMN IF NOT EXISTS "parent_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'style_categories_parent_id_fkey'
  ) THEN
    ALTER TABLE "style_categories"
      ADD CONSTRAINT "style_categories_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "style_categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "style_categories_parent_id_idx" ON "style_categories"("parent_id");
