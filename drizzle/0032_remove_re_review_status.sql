-- Remove 're_review' status from invoice_status enum
-- First, update any existing invoices with re_review status to pending
UPDATE "invoices" SET "status" = 'pending' WHERE "status" = 're_review';

-- Remove 'invoice_re_review' from notification_type enum
-- Note: PostgreSQL doesn't support removing enum values directly, but we can work around it
-- by not using this value anymore. The schema change will prevent new values from being created.

-- Remove the notification preference column for re_review
ALTER TABLE "users" DROP COLUMN IF EXISTS "notification_invoice_re_review";

-- Note: To fully remove enum values in PostgreSQL, you would need to:
-- 1. Create a new enum without the value
-- 2. Alter the column to use the new enum
-- 3. Drop the old enum
-- This is more complex and risky, so we're leaving the enum value in the database
-- but preventing it from being used in the application code.
