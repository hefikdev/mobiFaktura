-- Migration: Add settled_at column to budget_requests
-- Adds an explicit timestamp to record when a budget request was settled (rozliczono)

ALTER TABLE "budget_requests"
  ADD COLUMN IF NOT EXISTS "settled_at" TIMESTAMP WITH TIME ZONE;

-- Add index for lookup
CREATE INDEX IF NOT EXISTS "idx_budget_requests_settled_at" ON "budget_requests"("settled_at");

COMMENT ON COLUMN "budget_requests"."settled_at" IS 'Timestamp when the budget request was settled (rozliczono)';
