-- Migration: Add kwota (amount) field to invoices table
-- This field stores the invoice amount and is passed to the accountant

ALTER TABLE "invoices" ADD COLUMN "kwota" numeric(12, 2);

-- Add comment for documentation
COMMENT ON COLUMN "invoices"."kwota" IS 'Invoice amount provided by user, passed to accountant for verification';
