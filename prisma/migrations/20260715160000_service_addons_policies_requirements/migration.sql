-- CreateEnum
CREATE TYPE "remaining_balance_method" AS ENUM ('cash', 'card', 'cash_or_card');

-- AlterTable business_policies
ALTER TABLE "business_policies"
  ADD COLUMN "cancellation_policy_text" TEXT,
  ADD COLUMN "rescheduling_policy_text" TEXT,
  ADD COLUMN "late_arrival_policy_text" TEXT,
  ADD COLUMN "no_show_policy_text" TEXT,
  ADD COLUMN "refund_policy_text" TEXT,
  ADD COLUMN "children_policy_text" TEXT,
  ADD COLUMN "guest_policy_text" TEXT,
  ADD COLUMN "deposit_policy_text" TEXT,
  ADD COLUMN "remaining_balance_method" "remaining_balance_method" NOT NULL DEFAULT 'cash_or_card';

-- AlterTable service_offerings
ALTER TABLE "service_offerings"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "requirements" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "deposit_type" "deposit_type",
  ADD COLUMN "deposit_value" DECIMAL(10,2);

-- CreateTable service_addons
CREATE TABLE "service_addons" (
    "id" UUID NOT NULL,
    "service_offering_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "service_addons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_addons_service_offering_id_display_order_idx" ON "service_addons"("service_offering_id", "display_order");
CREATE INDEX "service_addons_service_offering_id_active_idx" ON "service_addons"("service_offering_id", "active");

ALTER TABLE "service_addons"
  ADD CONSTRAINT "service_addons_service_offering_id_fkey"
  FOREIGN KEY ("service_offering_id") REFERENCES "service_offerings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable bookings
ALTER TABLE "bookings"
  ADD COLUMN "addons_snapshot" JSONB,
  ADD COLUMN "remaining_balance_method" "remaining_balance_method",
  ADD COLUMN "requirements_acknowledged_at" TIMESTAMPTZ(6),
  ADD COLUMN "policies_acknowledged_at" TIMESTAMPTZ(6);
