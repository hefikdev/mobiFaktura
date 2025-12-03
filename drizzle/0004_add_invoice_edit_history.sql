-- Add invoice edit history table
CREATE TABLE IF NOT EXISTS "invoice_edit_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"edited_by" uuid NOT NULL,
	"previous_invoice_number" varchar(100),
	"new_invoice_number" varchar(100),
	"previous_description" text,
	"new_description" text,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign keys
ALTER TABLE "invoice_edit_history" ADD CONSTRAINT "invoice_edit_history_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "invoice_edit_history" ADD CONSTRAINT "invoice_edit_history_edited_by_users_id_fk" FOREIGN KEY ("edited_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS "invoice_edit_history_invoice_id_idx" ON "invoice_edit_history" ("invoice_id");
CREATE INDEX IF NOT EXISTS "invoice_edit_history_edited_at_idx" ON "invoice_edit_history" ("edited_at");
