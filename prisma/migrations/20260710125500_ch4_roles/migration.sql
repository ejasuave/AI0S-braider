-- CreateTable
CREATE TABLE "stylist_memberships" (
    "id" UUID NOT NULL,
    "stylist_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stylist_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "stylist_memberships_user_id_key" ON "stylist_memberships"("user_id");

-- CreateIndex
CREATE INDEX "stylist_memberships_stylist_id_idx" ON "stylist_memberships"("stylist_id");

-- AddForeignKey
ALTER TABLE "stylist_memberships" ADD CONSTRAINT "stylist_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
