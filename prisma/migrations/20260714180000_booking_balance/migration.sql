-- Balance remaining after deposit + multi payment kinds

CREATE TYPE "balance_status" AS ENUM ('not_due', 'due', 'paid_online', 'paid_in_person');
CREATE TYPE "payment_kind" AS ENUM ('deposit', 'balance');

ALTER TABLE "bookings"
  ADD COLUMN "balance_status" "balance_status" NOT NULL DEFAULT 'not_due',
  ADD COLUMN "balance_paid_at" TIMESTAMPTZ(6);

ALTER TABLE "payments"
  ADD COLUMN "kind" "payment_kind" NOT NULL DEFAULT 'deposit';

-- Allow one deposit and one balance payment per booking
-- Prisma models this as a UNIQUE INDEX named payments_booking_id_key (not a CONSTRAINT).
DROP INDEX IF EXISTS "payments_booking_id_key";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_booking_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "payments_booking_id_kind_key" ON "payments" ("booking_id", "kind");
