-- Migration: add invoice action logs table for audit trail
CREATE TABLE IF NOT EXISTS "invoice_action_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "action" varchar(100) NOT NULL,
  "performed_by" uuid NOT NULL REFERENCES "users"("id"),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "invoice_action_logs_invoice_id_idx" ON "invoice_action_logs"("invoice_id");
CREATE INDEX IF NOT EXISTS "invoice_action_logs_performed_by_idx" ON "invoice_action_logs"("performed_by");
CREATE INDEX IF NOT EXISTS "invoice_action_logs_created_at_idx" ON "invoice_action_logs"("created_at");
