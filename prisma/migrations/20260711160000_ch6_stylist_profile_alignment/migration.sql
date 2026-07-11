-- Chapter 6 — stylist profile alignment (business-centric model)

CREATE TYPE "deposit_type" AS ENUM ('flat', 'percentage');
CREATE TYPE "no_show_fee_type" AS ENUM ('forfeit_deposit', 'flat_fee', 'no_fee');

ALTER TABLE "businesses"
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "location_lat" DECIMAL(10,7),
  ADD COLUMN "location_lng" DECIMAL(10,7),
  ADD COLUMN "location_label" TEXT,
  ADD COLUMN "service_area_radius_km" DECIMAL(6,2),
  ADD COLUMN "onboarding_status" "onboarding_status" NOT NULL DEFAULT 'in_progress';

UPDATE "businesses" b
SET
  "bio" = sp."bio",
  "location_label" = sp."location_area",
  "service_area_radius_km" = sp."service_area_radius_km",
  "onboarding_status" = sp."onboarding_status",
  "business_name" = CASE WHEN b."business_name" = '' THEN sp."business_name" ELSE b."business_name" END
FROM "stylist_profiles" sp
WHERE sp."business_id" = b."id";

CREATE TABLE "business_policies" (
  "business_id" UUID NOT NULL,
  "deposit_type" "deposit_type" NOT NULL,
  "deposit_value" DECIMAL(10,2) NOT NULL,
  "cancellation_window_hours" INTEGER NOT NULL,
  "no_show_fee_type" "no_show_fee_type" NOT NULL,
  "no_show_fee_value" DECIMAL(10,2),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "business_policies_pkey" PRIMARY KEY ("business_id"),
  CONSTRAINT "business_policies_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
);

INSERT INTO "business_policies" (
  "business_id",
  "deposit_type",
  "deposit_value",
  "cancellation_window_hours",
  "no_show_fee_type",
  "no_show_fee_value",
  "updated_at"
)
SELECT
  sp."business_id",
  CASE
    WHEN (sp."deposit_policy"->>'type') = 'flat' THEN 'flat'::"deposit_type"
    ELSE 'percentage'::"deposit_type"
  END,
  COALESCE((sp."deposit_policy"->>'value')::DECIMAL, 20),
  COALESCE((sp."cancellation_policy"->>'windowHours')::INTEGER, 24),
  CASE
    WHEN COALESCE((sp."cancellation_policy"->>'noShowFeeAmount')::DECIMAL, 0) = 0 THEN 'no_fee'::"no_show_fee_type"
    ELSE 'forfeit_deposit'::"no_show_fee_type"
  END,
  NULL,
  CURRENT_TIMESTAMP
FROM "stylist_profiles" sp
WHERE sp."business_id" IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE TABLE "working_hours" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "working_hours_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "working_hours_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
);

CREATE INDEX "working_hours_business_id_day_of_week_idx" ON "working_hours"("business_id", "day_of_week");

CREATE TABLE "schedule_exceptions" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "is_closed" BOOLEAN NOT NULL DEFAULT false,
  "override_start_time" TEXT,
  "override_end_time" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "schedule_exceptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_exceptions_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "schedule_exceptions_business_id_date_key" ON "schedule_exceptions"("business_id", "date");

CREATE TABLE "instagram_connections" (
  "business_id" UUID NOT NULL,
  "instagram_user_id" TEXT NOT NULL,
  "access_token_enc" TEXT NOT NULL,
  "token_expires_at" TIMESTAMPTZ(6) NOT NULL,
  "connected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "instagram_connections_pkey" PRIMARY KEY ("business_id"),
  CONSTRAINT "instagram_connections_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE
);

ALTER TABLE "style_categories" ADD COLUMN "is_custom" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "portfolio_items" ADD COLUMN "business_id" UUID;

UPDATE "portfolio_items" pi
SET "business_id" = sp."business_id"
FROM "stylist_profiles" sp
WHERE pi."stylist_id" = sp."id" AND sp."business_id" IS NOT NULL;

ALTER TABLE "portfolio_items" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "portfolio_items"
  ADD CONSTRAINT "portfolio_items_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;

CREATE INDEX "portfolio_items_business_id_display_order_idx" ON "portfolio_items"("business_id", "display_order");

ALTER TABLE "service_offerings" ADD COLUMN "business_id" UUID;
ALTER TABLE "service_offerings" ADD COLUMN "style_category_id" UUID;

UPDATE "service_offerings" so
SET "business_id" = sp."business_id"
FROM "stylist_profiles" sp
WHERE so."stylist_id" = sp."id" AND sp."business_id" IS NOT NULL;

ALTER TABLE "service_offerings" ALTER COLUMN "business_id" SET NOT NULL;
ALTER TABLE "service_offerings"
  ADD CONSTRAINT "service_offerings_business_id_fkey"
  FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;
ALTER TABLE "service_offerings"
  ADD CONSTRAINT "service_offerings_style_category_id_fkey"
  FOREIGN KEY ("style_category_id") REFERENCES "style_categories"("id") ON DELETE SET NULL;

CREATE INDEX "service_offerings_business_id_active_idx" ON "service_offerings"("business_id", "active");
