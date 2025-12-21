-- Add new notification types for budget system
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'budget_request_submitted';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'budget_request_approved';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'budget_request_rejected';
ALTER TYPE "notification_type" ADD VALUE IF NOT EXISTS 'saldo_adjusted';

-- Add new notification preference columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_budget_request_submitted" boolean NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_budget_request_approved" boolean NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_budget_request_rejected" boolean NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notification_saldo_adjusted" boolean NOT NULL DEFAULT true;
