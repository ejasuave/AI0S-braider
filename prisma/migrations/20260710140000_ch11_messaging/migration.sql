-- Chapter 11: Messaging — conversations, messages, escalations

CREATE TYPE "conversation_channel" AS ENUM ('sms', 'whatsapp', 'web');
CREATE TYPE "conversation_status" AS ENUM ('active', 'escalated', 'resolved', 'abandoned');
CREATE TYPE "message_sender" AS ENUM ('client', 'ai', 'stylist', 'system');

ALTER TABLE "stylist_profiles" ADD COLUMN "sms_booking_number" TEXT;

CREATE UNIQUE INDEX "stylist_profiles_sms_booking_number_key" ON "stylist_profiles"("sms_booking_number");

CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "stylist_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "channel" "conversation_channel" NOT NULL,
    "status" "conversation_status" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender" "message_sender" NOT NULL,
    "content" TEXT NOT NULL,
    "structured_output" JSONB,
    "provider_message_id" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "escalations" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by_id" UUID,

    CONSTRAINT "escalations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversations_stylist_id_status_last_message_at_idx" ON "conversations"("stylist_id", "status", "last_message_at");
CREATE INDEX "conversations_client_id_last_message_at_idx" ON "conversations"("client_id", "last_message_at");
CREATE INDEX "conversations_stylist_id_client_id_channel_status_idx" ON "conversations"("stylist_id", "client_id", "channel", "status");
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
CREATE UNIQUE INDEX "messages_provider_message_id_key" ON "messages"("provider_message_id");
CREATE INDEX "escalations_conversation_id_created_at_idx" ON "escalations"("conversation_id", "created_at");

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_stylist_id_fkey" FOREIGN KEY ("stylist_id") REFERENCES "stylist_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
