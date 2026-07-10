-- Chapter 6: stylist profiles, portfolio, service offerings, style taxonomy

CREATE TYPE "onboarding_status" AS ENUM ('in_progress', 'complete');
CREATE TYPE "portfolio_source" AS ENUM ('manual', 'instagram');

CREATE TABLE "stylist_profiles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "business_name" TEXT NOT NULL DEFAULT '',
    "bio" TEXT,
    "location_area" TEXT,
    "service_area_radius_km" DECIMAL(6,2),
    "cancellation_policy" JSONB,
    "deposit_policy" JSONB,
    "working_hours" JSONB,
    "buffer_minutes" INTEGER NOT NULL DEFAULT 0,
    "onboarding_status" "onboarding_status" NOT NULL DEFAULT 'in_progress',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stylist_profiles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "portfolio_items" (
    "id" UUID NOT NULL,
    "stylist_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "storage_key" TEXT,
    "source" "portfolio_source" NOT NULL DEFAULT 'manual',
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_offerings" (
    "id" UUID NOT NULL,
    "stylist_id" UUID NOT NULL,
    "style_name" TEXT NOT NULL,
    "size_tier" TEXT,
    "length_tier" TEXT,
    "base_price" DECIMAL(10,2) NOT NULL,
    "estimated_duration_minutes" INTEGER NOT NULL,
    "hair_included" BOOLEAN NOT NULL DEFAULT false,
    "is_custom_style" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_offerings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "style_categories" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "size_tiers" JSONB NOT NULL DEFAULT '[]',
    "length_tiers" JSONB NOT NULL DEFAULT '[]',
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "style_categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stylist_profiles_user_id_key" ON "stylist_profiles"("user_id");
CREATE INDEX "portfolio_items_stylist_id_display_order_idx" ON "portfolio_items"("stylist_id", "display_order");
CREATE INDEX "service_offerings_stylist_id_active_idx" ON "service_offerings"("stylist_id", "active");
CREATE INDEX "service_offerings_stylist_id_style_name_idx" ON "service_offerings"("stylist_id", "style_name");
CREATE UNIQUE INDEX "style_categories_name_key" ON "style_categories"("name");
CREATE UNIQUE INDEX "style_categories_slug_key" ON "style_categories"("slug");

ALTER TABLE "stylist_profiles" ADD CONSTRAINT "stylist_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_stylist_id_fkey" FOREIGN KEY ("stylist_id") REFERENCES "stylist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "service_offerings" ADD CONSTRAINT "service_offerings_stylist_id_fkey" FOREIGN KEY ("stylist_id") REFERENCES "stylist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
