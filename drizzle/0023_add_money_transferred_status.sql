-- Migration: Add money_transferred status and transfer tracking fields
-- Adds intermediate status between approved and settled, with transfer number and date

-- Add new columns for transfer tracking
ALTER TABLE "budget_requests" ADD COLUMN "transfer_number" VARCHAR(255);
ALTER TABLE "budget_requests" ADD COLUMN "transfer_date" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "budget_requests" ADD COLUMN "transfer_confirmed_by" UUID REFERENCES "users"("id");
ALTER TABLE "budget_requests" ADD COLUMN "transfer_confirmed_at" TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN "budget_requests"."transfer_number" IS 'Bank transfer number/reference (required for money_transferred status)';
COMMENT ON COLUMN "budget_requests"."transfer_date" IS 'Date when the transfer was made';
COMMENT ON COLUMN "budget_requests"."transfer_confirmed_by" IS 'Accountant/admin who confirmed the transfer';
COMMENT ON COLUMN "budget_requests"."transfer_confirmed_at" IS 'Timestamp when transfer was confirmed in the system';

-- Note: Status enum now supports: 'pending', 'approved', 'money_transferred', 'rejected', 'rozliczono'
-- The status column already exists as VARCHAR(20), so it can accommodate the new status without ALTER
