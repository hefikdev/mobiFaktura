-- Add budget_request_id to invoices table to track which zaliczka funded each invoice
ALTER TABLE invoices ADD COLUMN budget_request_id uuid REFERENCES budget_requests(id) ON DELETE SET NULL;

-- Add index for faster queries
CREATE INDEX idx_invoices_budget_request_id ON invoices(budget_request_id);

-- Note: This allows tracking which budget request funded which invoice
-- This enables:
-- 1. Showing which zaliczka is linked to an invoice
-- 2. Updating all linked invoices when a budget request is settled
-- 3. Future per-company budget tracking
