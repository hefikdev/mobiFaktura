-- Add invoice_deletion_requests table
CREATE TABLE "invoice_deletion_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE CASCADE,
  "requested_by" uuid NOT NULL REFERENCES "users"("id"),
  "reason" text NOT NULL,
  "status" varchar(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  "reviewed_by" uuid REFERENCES "users"("id"),
  "reviewed_at" timestamp with time zone,
  "rejection_reason" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX "idx_deletion_requests_status" ON "invoice_deletion_requests"("status");
CREATE INDEX "idx_deletion_requests_invoice" ON "invoice_deletion_requests"("invoice_id");
