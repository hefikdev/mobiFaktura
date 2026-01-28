-- Migration: Fix character limits for budget_requests and companies
-- Description: Updates justification to 2000 chars and address to 50 chars

-- Alter budget_requests.justification from VARCHAR(1000) to VARCHAR(2000)
ALTER TABLE budget_requests
ALTER COLUMN justification TYPE VARCHAR(2000);

-- Alter companies.address from VARCHAR(1024) to VARCHAR(50)
-- Note: This will truncate existing addresses longer than 50 characters
-- Consider backing up data if you have addresses longer than 50 chars
ALTER TABLE companies
ALTER COLUMN address TYPE VARCHAR(50);

-- Note: budget_requests.rejection_reason stays VARCHAR(1000) (no change needed)
-- Note: invoice_edit_history descriptions are already VARCHAR(2000) (no change needed)
