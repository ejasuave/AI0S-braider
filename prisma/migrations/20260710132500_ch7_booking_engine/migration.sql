-- Chapter 7: booking engine

CREATE TYPE "booking_status" AS ENUM ('held', 'confirmed', 'completed', 'cancelled', 'no_show');
CREATE TYPE "booking_deposit_status" AS ENUM ('pending', 'paid', 'refunded', 'forfeited');
CREATE TYPE "booking_source" AS ENUM ('ai_agent', 'dashboard_manual', 'client_direct');

CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "stylist_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "service_offering_id" UUID NOT NULL,
    "status" "booking_status" NOT NULL DEFAULT 'held',
    "start_time" TIMESTAMPTZ(6) NOT NULL,
    "end_time" TIMESTAMPTZ(6) NOT NULL,
    "agreed_price" DECIMAL(10,2) NOT NULL,
    "agreed_duration_minutes" INTEGER NOT NULL,
    "deposit_amount" DECIMAL(10,2) NOT NULL,
    "deposit_status" "booking_deposit_status" NOT NULL DEFAULT 'pending',
    "hold_expires_at" TIMESTAMPTZ(6),
    "source" "booking_source" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelled_at" TIMESTAMPTZ(6),
    "cancellation_reason" TEXT,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "bookings_stylist_id_status_start_time_end_time_idx" ON "bookings"("stylist_id", "status", "start_time", "end_time");
CREATE INDEX "bookings_client_id_status_idx" ON "bookings"("client_id", "status");
CREATE INDEX "bookings_hold_expires_at_idx" ON "bookings"("hold_expires_at");

ALTER TABLE "bookings" ADD CONSTRAINT "bookings_stylist_id_fkey" FOREIGN KEY ("stylist_id") REFERENCES "stylist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_offering_id_fkey" FOREIGN KEY ("service_offering_id") REFERENCES "service_offerings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
