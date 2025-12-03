-- Remove currency field from invoices table
ALTER TABLE "invoices" DROP COLUMN IF EXISTS "currency";

-- Add rejection_reason field to invoices table
ALTER TABLE "invoices" ADD COLUMN "rejection_reason" text;
