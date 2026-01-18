-- Migration: Rename 'paragon' to 'receipt' in invoice_type enum

-- Step 1: Update any existing 'paragon' values to 'einvoice' temporarily
UPDATE invoices SET invoice_type = 'einvoice' WHERE invoice_type = 'paragon';

-- Step 2: Drop and recreate the enum type with the new value
ALTER TABLE invoices ALTER COLUMN invoice_type DROP DEFAULT;
ALTER TABLE invoices ALTER COLUMN invoice_type TYPE text;

DROP TYPE IF EXISTS invoice_type;
CREATE TYPE invoice_type AS ENUM ('einvoice', 'receipt', 'correction');

ALTER TABLE invoices ALTER COLUMN invoice_type TYPE invoice_type USING invoice_type::invoice_type;
ALTER TABLE invoices ALTER COLUMN invoice_type SET DEFAULT 'einvoice'::invoice_type;
ALTER TABLE invoices ALTER COLUMN invoice_type SET NOT NULL;

-- Update comment
COMMENT ON COLUMN invoices.invoice_type IS 'Type of invoice: einvoice (e-faktura with KSeF), receipt (paragon without KSeF), correction (faktura korygująca)';
