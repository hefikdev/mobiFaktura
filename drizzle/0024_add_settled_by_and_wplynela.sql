-- Migration: Add settled_by tracking and wpłynęła status
-- Adds comprehensive audit trail for budget request settlements and invoice payments
-- Adds new invoice statuses for payment received and settled

-- Add settledBy field to budget_requests for complete audit trail
ALTER TABLE "budget_requests" ADD COLUMN "settled_by" UUID REFERENCES "users"("id");

-- Add payment tracking fields to invoices
ALTER TABLE "invoices" ADD COLUMN "wplynela_by" UUID REFERENCES "users"("id");
ALTER TABLE "invoices" ADD COLUMN "wplynela_at" TIMESTAMP WITH TIME ZONE;
ALTER TABLE "invoices" ADD COLUMN "settled_by" UUID REFERENCES "users"("id");
ALTER TABLE "invoices" ADD COLUMN "settled_at" TIMESTAMP WITH TIME ZONE;

-- Add comments for documentation
COMMENT ON COLUMN "budget_requests"."settled_by" IS 'Accountant/admin who marked the request as settled';
COMMENT ON COLUMN "invoices"."wplynela_by" IS 'Accountant/admin who marked the payment as received';
COMMENT ON COLUMN "invoices"."wplynela_at" IS 'Timestamp when payment was marked as received';
COMMENT ON COLUMN "invoices"."settled_by" IS 'Accountant/admin who marked the invoice as settled';
COMMENT ON COLUMN "invoices"."settled_at" IS 'Timestamp when invoice was marked as settled';

-- Note: The invoice_status enum needs to be updated to include 'wplynela' and 'settled'
-- This will be handled by recreating the enum with the new values
DO $$ BEGIN
  -- Drop the old enum and recreate with new values
  ALTER TYPE invoice_status RENAME TO invoice_status_old;
  CREATE TYPE invoice_status AS ENUM ('pending', 'in_review', 'accepted', 'wplynela', 'settled', 'rejected', 're_review');
  ALTER TABLE invoices ALTER COLUMN status TYPE invoice_status USING status::text::invoice_status;
  DROP TYPE invoice_status_old;
END $$;
