-- Chapter 11 alignment: outbound message delivery tracking (Prompt 11.2)

CREATE TYPE "message_delivery_status" AS ENUM ('pending', 'sent', 'delivered', 'failed', 'undelivered');

ALTER TABLE "messages" ADD COLUMN "delivery_status" "message_delivery_status";
