-- Chapter 13: Record model confidence and next_action on escalations for tuning/review

ALTER TABLE "escalations"
  ADD COLUMN "model_confidence" DOUBLE PRECISION,
  ADD COLUMN "model_next_action" TEXT;
