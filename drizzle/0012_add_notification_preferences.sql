-- Add notification preferences to users table
ALTER TABLE "users" ADD COLUMN "notification_sound" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN "notification_invoice_accepted" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN "notification_invoice_rejected" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN "notification_invoice_submitted" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN "notification_invoice_assigned" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN "notification_invoice_re_review" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN "notification_system_message" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN "notification_company_updated" boolean DEFAULT true NOT NULL;
ALTER TABLE "users" ADD COLUMN "notification_password_changed" boolean DEFAULT true NOT NULL;
