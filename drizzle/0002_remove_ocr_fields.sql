-- Remove OCR-related and obsolete fields from invoices table
ALTER TABLE "invoices" DROP COLUMN IF EXISTS "invoice_date";
ALTER TABLE "invoices" DROP COLUMN IF EXISTS "supplier_name";
ALTER TABLE "invoices" DROP COLUMN IF EXISTS "supplier_nip";
ALTER TABLE "invoices" DROP COLUMN IF EXISTS "total_amount";

-- Add tracking fields for edits
ALTER TABLE "invoices" ADD COLUMN "last_edited_by" uuid REFERENCES "users"("id");
ALTER TABLE "invoices" ADD COLUMN "last_edited_at" timestamp with time zone;
