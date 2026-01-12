-- Migration: Rename 'wplynela' to 'transferred' in database
-- This keeps the database column names and enum values in English while UI stays in Polish

-- Step 1: Rename columns in invoices table
ALTER TABLE "invoices" RENAME COLUMN "wplynela_by" TO "transferred_by";
ALTER TABLE "invoices" RENAME COLUMN "wplynela_at" TO "transferred_at";

-- Step 2: Update column comments
COMMENT ON COLUMN "invoices"."transferred_by" IS 'Accountant/admin who marked the payment as received/transferred';
COMMENT ON COLUMN "invoices"."transferred_at" IS 'Timestamp when payment was marked as received/transferred';

-- Step 3: Update invoice_status enum to use 'transferred' instead of 'wplynela'
-- We need to do this carefully to avoid breaking existing data
ALTER TYPE invoice_status RENAME TO invoice_status_old;

CREATE TYPE invoice_status AS ENUM ('pending', 'in_review', 'accepted', 'transferred', 'settled', 'rejected', 're_review');

-- Update existing data to use new enum value
ALTER TABLE "invoices" ALTER COLUMN "status" TYPE invoice_status USING (
  CASE 
    WHEN "status"::text = 'wplynela' THEN 'transferred'::invoice_status
    ELSE "status"::text::invoice_status
  END
);

-- Drop old enum type
DROP TYPE invoice_status_old;
