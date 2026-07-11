-- Chapter 9: payments and Stripe Connect

CREATE TYPE "payment_status" AS ENUM ('pending', 'captured', 'refunded', 'forfeited', 'failed');

CREATE TABLE "stylist_stripe_accounts" (
    "id" UUID NOT NULL,
    "stylist_id" UUID NOT NULL,
    "stripe_account_id" TEXT NOT NULL,
    "charges_enabled" BOOLEAN NOT NULL DEFAULT false,
    "payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "onboarding_complete" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "stylist_stripe_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stylist_stripe_accounts_stylist_id_key" ON "stylist_stripe_accounts"("stylist_id");
CREATE UNIQUE INDEX "stylist_stripe_accounts_stripe_account_id_key" ON "stylist_stripe_accounts"("stripe_account_id");

CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "booking_id" UUID NOT NULL,
    "stripe_payment_intent_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'gbp',
    "status" "payment_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "captured_at" TIMESTAMPTZ(6),

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payments_booking_id_key" ON "payments"("booking_id");
CREATE UNIQUE INDEX "payments_stripe_payment_intent_id_key" ON "payments"("stripe_payment_intent_id");
