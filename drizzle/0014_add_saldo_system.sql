-- Migration: Add saldo (balance) system
-- This allows admin/accountant to assign budget to users
-- Saldo is reduced when user submits invoices

-- Add saldo field to users table
ALTER TABLE "users" ADD COLUMN "saldo" numeric(12, 2) NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN "users"."saldo" IS 'User budget balance, reduced by invoice kwota on submission, can be negative';

-- Create saldo transactions table to track all changes
CREATE TABLE IF NOT EXISTS "saldo_transactions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "amount" numeric(12, 2) NOT NULL,
    "balance_before" numeric(12, 2) NOT NULL,
    "balance_after" numeric(12, 2) NOT NULL,
    "transaction_type" VARCHAR(50) NOT NULL, -- 'adjustment', 'invoice_deduction', 'invoice_refund'
    "reference_id" UUID, -- invoice id if related to invoice
    "notes" TEXT,
    "created_by" UUID NOT NULL REFERENCES "users"("id"),
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX "idx_saldo_transactions_user_id" ON "saldo_transactions"("user_id");
CREATE INDEX "idx_saldo_transactions_created_at" ON "saldo_transactions"("created_at" DESC);
CREATE INDEX "idx_saldo_transactions_reference_id" ON "saldo_transactions"("reference_id");

-- Add comment for documentation
COMMENT ON TABLE "saldo_transactions" IS 'Tracks all saldo balance changes including admin adjustments and invoice deductions';
