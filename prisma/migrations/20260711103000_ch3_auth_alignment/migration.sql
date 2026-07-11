-- Ch.3 alignment: OAuth token encryption fields + phone change requests

CREATE TYPE "phone_change_status" AS ENUM ('pending', 'approved', 'rejected');

ALTER TABLE "oauth_accounts"
ADD COLUMN "access_token_enc" TEXT,
ADD COLUMN "refresh_token_enc" TEXT;

CREATE TABLE "phone_number_change_requests" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "requested_phone_number" TEXT NOT NULL,
    "status" "phone_change_status" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by" UUID,

    CONSTRAINT "phone_number_change_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "phone_number_change_requests_user_id_status_idx" ON "phone_number_change_requests"("user_id", "status");

ALTER TABLE "phone_number_change_requests" ADD CONSTRAINT "phone_number_change_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "phone_number_change_requests" ADD CONSTRAINT "phone_number_change_requests_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
