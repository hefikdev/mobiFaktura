CREATE TYPE "public"."invoice_type" AS ENUM('einvoice', 'receipt', 'correction');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "invoice_action_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"action" varchar(100) NOT NULL,
	"performed_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advances" RENAME TO "zaliczki";--> statement-breakpoint
ALTER TABLE "invoices" RENAME COLUMN "advance_id" TO "invoice_type";--> statement-breakpoint
ALTER TABLE "zaliczki" DROP CONSTRAINT "advances_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "zaliczki" DROP CONSTRAINT "advances_company_id_companies_id_fk";
--> statement-breakpoint
ALTER TABLE "zaliczki" DROP CONSTRAINT "advances_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "budget_requests" DROP CONSTRAINT "budget_requests_settled_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "budget_requests" DROP CONSTRAINT "budget_requests_transfer_confirmed_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_advance_id_advances_id_fk";
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_advances_user_id";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_advances_status";--> statement-breakpoint
ALTER TABLE "zaliczki" ALTER COLUMN "description" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "budget_requests" ALTER COLUMN "justification" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "budget_requests" ALTER COLUMN "rejection_reason" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "address" SET DATA TYPE varchar(1024);--> statement-breakpoint
ALTER TABLE "invoice_deletion_requests" ALTER COLUMN "reason" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "invoice_deletion_requests" ALTER COLUMN "rejection_reason" SET DATA TYPE varchar(2000);--> statement-breakpoint
ALTER TABLE "invoice_edit_history" ALTER COLUMN "previous_description" SET DATA TYPE varchar(2000);--> statement-breakpoint
ALTER TABLE "invoice_edit_history" ALTER COLUMN "new_description" SET DATA TYPE varchar(2000);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "image_key" SET DATA TYPE varchar(1024);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "description" SET DATA TYPE varchar(2000);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "justification" SET DATA TYPE varchar(2000);--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "rejection_reason" SET DATA TYPE varchar(1000);--> statement-breakpoint
UPDATE "login_attempts" SET "attempt_count" = '0' WHERE "attempt_count" !~ '^[0-9]+$';--> statement-breakpoint
ALTER TABLE "login_attempts" ALTER COLUMN "attempt_count" SET DATA TYPE integer USING attempt_count::integer;--> statement-breakpoint
ALTER TABLE "login_attempts" ALTER COLUMN "attempt_count" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "login_logs" ALTER COLUMN "user_agent" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "notifications" ALTER COLUMN "message" SET DATA TYPE varchar(2000);--> statement-breakpoint
ALTER TABLE "saldo_transactions" ALTER COLUMN "notes" SET DATA TYPE varchar(1000);--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "zaliczki" ADD COLUMN "transfer_number" varchar(255);--> statement-breakpoint
ALTER TABLE "zaliczki" ADD COLUMN "transfer_confirmed_by" uuid;--> statement-breakpoint
ALTER TABLE "zaliczki" ADD COLUMN "transfer_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "zaliczki" ADD COLUMN "settled_by" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "original_invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "correction_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "zaliczka_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoice_action_logs" ADD CONSTRAINT "invoice_action_logs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoice_action_logs" ADD CONSTRAINT "invoice_action_logs_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_action_logs_invoice_id_idx" ON "invoice_action_logs" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_action_logs_performed_by_idx" ON "invoice_action_logs" USING btree ("performed_by");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "invoice_action_logs_created_at_idx" ON "invoice_action_logs" USING btree ("created_at");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "zaliczki" ADD CONSTRAINT "zaliczki_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "zaliczki" ADD CONSTRAINT "zaliczki_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "zaliczki" ADD CONSTRAINT "zaliczki_transfer_confirmed_by_users_id_fk" FOREIGN KEY ("transfer_confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "zaliczki" ADD CONSTRAINT "zaliczki_settled_by_users_id_fk" FOREIGN KEY ("settled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "zaliczki" ADD CONSTRAINT "zaliczki_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_original_invoice_id_invoices_id_fk" FOREIGN KEY ("original_invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "invoices" ADD CONSTRAINT "invoices_zaliczka_id_zaliczki_id_fk" FOREIGN KEY ("zaliczka_id") REFERENCES "public"."zaliczki"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zaliczki_user_id" ON "zaliczki" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_zaliczki_status" ON "zaliczki" USING btree ("status");--> statement-breakpoint
ALTER TABLE "budget_requests" DROP COLUMN IF EXISTS "settled_by";--> statement-breakpoint
ALTER TABLE "budget_requests" DROP COLUMN IF EXISTS "settled_at";--> statement-breakpoint
ALTER TABLE "budget_requests" DROP COLUMN IF EXISTS "transfer_number";--> statement-breakpoint
ALTER TABLE "budget_requests" DROP COLUMN IF EXISTS "transfer_date";--> statement-breakpoint
ALTER TABLE "budget_requests" DROP COLUMN IF EXISTS "transfer_confirmed_by";--> statement-breakpoint
ALTER TABLE "budget_requests" DROP COLUMN IF EXISTS "transfer_confirmed_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN IF EXISTS "notification_invoice_re_review";--> statement-breakpoint
ALTER TABLE "public"."invoices" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."invoice_status";--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'in_review', 'accepted', 'transferred', 'settled', 'rejected');--> statement-breakpoint
ALTER TABLE "public"."invoices" ALTER COLUMN "status" SET DATA TYPE "public"."invoice_status" USING "status"::"public"."invoice_status";--> statement-breakpoint
ALTER TABLE "public"."notifications" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."notification_type";--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('invoice_accepted', 'invoice_rejected', 'invoice_submitted', 'invoice_assigned', 'budget_request_submitted', 'budget_request_approved', 'budget_request_rejected', 'saldo_adjusted', 'system_message', 'company_updated', 'password_changed');--> statement-breakpoint
ALTER TABLE "public"."notifications" ALTER COLUMN "type" SET DATA TYPE "public"."notification_type" USING "type"::"public"."notification_type";