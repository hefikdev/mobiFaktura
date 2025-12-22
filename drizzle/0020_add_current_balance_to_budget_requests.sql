-- Migration: Add current balance at request time to budget requests
-- Store the user's balance when the budget request was created

ALTER TABLE "budget_requests" ADD COLUMN "current_balance_at_request" numeric(12, 2) NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN "budget_requests"."current_balance_at_request" IS 'User balance at the time the budget request was created';