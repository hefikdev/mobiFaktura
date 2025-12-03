-- Migration: Add lastReviewPing field for heartbeat tracking
-- This field tracks when the accountant last sent a ping while reviewing an invoice
-- Used to detect stale reviews and automatically release them

ALTER TABLE "invoices" ADD COLUMN "last_review_ping" timestamp with time zone;

-- Add comment for documentation
COMMENT ON COLUMN "invoices"."last_review_ping" IS 'Timestamp of last heartbeat ping from accountant during review. Used to detect stale reviews.';
