-- Migration: Drop unused invoice_deletion_requests table
-- Description: This table was never implemented or used in the application.
--              Invoice deletion is handled directly without a request/approval workflow.

-- Drop the table (will also drop associated indexes and constraints)
DROP TABLE IF EXISTS "invoice_deletion_requests" CASCADE;

-- Note: This table existed in the schema but was never used:
-- - No imports of invoiceDeletionRequests in any code file
-- - No queries, inserts, updates, or deletes performed on this table
-- - Invoice deletion implemented directly via invoice.delete and admin.deleteInvoice endpoints
