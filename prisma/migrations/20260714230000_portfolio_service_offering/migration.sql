-- Link portfolio images to a specific service offering (nullable for legacy/Instagram)

ALTER TABLE "portfolio_items"
  ADD COLUMN "service_offering_id" UUID;

ALTER TABLE "portfolio_items"
  ADD CONSTRAINT "portfolio_items_service_offering_id_fkey"
  FOREIGN KEY ("service_offering_id") REFERENCES "service_offerings"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "portfolio_items_service_offering_id_display_order_idx"
  ON "portfolio_items"("service_offering_id", "display_order");
