-- Chapter 17 — Dashboards (approval mode, client profile, saved stylists)

ALTER TABLE "stylist_profiles"
  ADD COLUMN "require_stylist_approval" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "bookings"
  ADD COLUMN "stylist_approved_at" TIMESTAMPTZ(6);

CREATE TABLE "client_profiles" (
  "user_id" UUID NOT NULL,
  "display_name" TEXT,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "client_profiles_pkey" PRIMARY KEY ("user_id")
);

CREATE TABLE "saved_stylists" (
  "client_id" UUID NOT NULL,
  "stylist_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "saved_stylists_pkey" PRIMARY KEY ("client_id", "stylist_id")
);

ALTER TABLE "client_profiles"
  ADD CONSTRAINT "client_profiles_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_stylists"
  ADD CONSTRAINT "saved_stylists_client_id_fkey"
  FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "saved_stylists"
  ADD CONSTRAINT "saved_stylists_stylist_id_fkey"
  FOREIGN KEY ("stylist_id") REFERENCES "stylist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "saved_stylists_client_id_created_at_idx"
  ON "saved_stylists"("client_id", "created_at");
