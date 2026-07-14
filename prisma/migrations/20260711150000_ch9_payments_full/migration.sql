-- Chapter 9: Payments & Deposits (full prompt library)

CREATE TYPE "payment_onboarding_status" AS ENUM ('not_started', 'in_progress', 'complete', 'restricted');

CREATE TABLE "payment_accounts" (
    "business_id" UUID NOT NULL,
    "stripe_connect_account_id" TEXT NOT NULL,
    "onboarding_status" "payment_onboarding_status" NOT NULL DEFAULT 'not_started',
    "charges_enabled" BOOLEAN NOT NULL DEFAULT false,
    "payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payment_accounts_pkey" PRIMARY KEY ("business_id")
);

CREATE UNIQUE INDEX "payment_accounts_stripe_connect_account_id_key"
    ON "payment_accounts"("stripe_connect_account_id");

ALTER TABLE "payment_accounts"
    ADD CONSTRAINT "payment_accounts_business_id_fkey"
    FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "payment_accounts" (
    "business_id",
    "stripe_connect_account_id",
    "onboarding_status",
    "charges_enabled",
    "payouts_enabled",
    "created_at",
    "updated_at"
)
SELECT
    sp."business_id",
    ssa."stripe_account_id",
    CASE
        WHEN ssa."onboarding_complete" THEN 'complete'::"payment_onboarding_status"
        WHEN ssa."charges_enabled" THEN 'in_progress'::"payment_onboarding_status"
        ELSE 'not_started'::"payment_onboarding_status"
    END,
    ssa."charges_enabled",
    ssa."payouts_enabled",
    ssa."created_at",
    ssa."updated_at"
FROM "stylist_stripe_accounts" ssa
INNER JOIN "stylist_profiles" sp ON sp."id" = ssa."stylist_id"
WHERE sp."business_id" IS NOT NULL;

DROP TABLE "stylist_stripe_accounts";

ALTER TABLE "bookings" ADD COLUMN "policy_snapshot" JSONB;

ALTER TABLE "payments" ADD COLUMN "refunded_amount" DECIMAL(10, 2);

DELETE FROM "payments" p
WHERE NOT EXISTS (SELECT 1 FROM "bookings" b WHERE b.id = p.booking_id);

CREATE TABLE "dispute_evidence_packages" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "assembled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_to_stripe_at" TIMESTAMPTZ(6),
    "evidence_data" JSONB NOT NULL,
    "is_complete" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "dispute_evidence_packages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "dispute_evidence_packages_booking_id_idx"
    ON "dispute_evidence_packages"("booking_id");

ALTER TABLE "dispute_evidence_packages"
    ADD CONSTRAINT "dispute_evidence_packages_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dispute_evidence_packages"
    ADD CONSTRAINT "dispute_evidence_packages_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments"
    ADD CONSTRAINT "payments_booking_id_fkey"
    FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
