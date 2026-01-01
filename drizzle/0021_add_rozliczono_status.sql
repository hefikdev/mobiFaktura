-- Migration: Add 'rozliczono' status to budget requests
-- This status indicates that a budget request has been settled/finalized

-- No need to modify the column since it's already a VARCHAR(20)
-- The status column in budget_requests table can already hold 'rozliczono'

-- Add comment for documentation
COMMENT ON COLUMN "budget_requests"."status" IS 'Budget request status: pending, approved, rejected, rozliczono';
