-- Migration: Add invoice types (einvoice, paragon, correction)
-- Description: Adds invoice_type field and correction invoice support

-- Add invoice_type enum
DO $$ BEGIN
    CREATE TYPE invoice_type AS ENUM ('einvoice', 'paragon', 'correction');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add invoice_type column to invoices table (default to 'einvoice' for existing records)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS invoice_type invoice_type NOT NULL DEFAULT 'einvoice';

-- Add original_invoice_id for correction invoices (self-referencing)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS original_invoice_id UUID REFERENCES invoices(id) ON DELETE RESTRICT;

-- Add correction_amount for correction invoices (positive amount that increases user balance)
ALTER TABLE invoices
ADD COLUMN IF NOT EXISTS correction_amount NUMERIC(12, 2);

-- Create index for original_invoice_id lookups (to find all corrections for an invoice)
CREATE INDEX IF NOT EXISTS idx_invoices_original_invoice_id ON invoices(original_invoice_id);

-- Create index for invoice_type filtering
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type ON invoices(invoice_type);

-- Add constraint: correction invoices must have original_invoice_id
ALTER TABLE invoices
ADD CONSTRAINT check_correction_has_original 
CHECK (
    (invoice_type = 'correction' AND original_invoice_id IS NOT NULL AND correction_amount IS NOT NULL)
    OR 
    (invoice_type != 'correction' AND original_invoice_id IS NULL AND correction_amount IS NULL)
);

-- Add constraint: correction_amount must be positive
ALTER TABLE invoices
ADD CONSTRAINT check_correction_amount_positive
CHECK (correction_amount IS NULL OR correction_amount > 0);

-- Add constraint: paragon should not have ksef_number (business logic)
-- Note: This is a soft constraint - we'll enforce it in the application layer
-- to allow for data migration flexibility

COMMENT ON COLUMN invoices.invoice_type IS 'Type of invoice: einvoice (e-faktura with KSeF), paragon (receipt without KSeF), correction (faktura korygująca)';
COMMENT ON COLUMN invoices.original_invoice_id IS 'Reference to original invoice for correction invoices only';
COMMENT ON COLUMN invoices.correction_amount IS 'Positive amount that increases user balance (for correction invoices only)';
