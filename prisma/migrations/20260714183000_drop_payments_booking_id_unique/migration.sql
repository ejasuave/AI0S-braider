-- The prior migration used DROP CONSTRAINT, but Prisma created a UNIQUE INDEX
-- (not a table constraint). The leftover one-payment-per-booking index blocks
-- deposit + balance rows for the same booking.

DROP INDEX IF EXISTS "payments_booking_id_key";
