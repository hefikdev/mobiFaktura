-- Migration: Add login_logs table for tracking login attempts
-- Tracks all login attempts with IP address, success status, and timestamp

CREATE TABLE IF NOT EXISTS "login_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"ip_address" varchar(45),
	"success" boolean NOT NULL,
	"user_id" uuid,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Add foreign key
ALTER TABLE "login_logs" ADD CONSTRAINT "login_logs_user_id_users_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE set null ON UPDATE no action;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS "login_logs_created_at_idx" ON "login_logs"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "login_logs_user_id_idx" ON "login_logs"("user_id");
CREATE INDEX IF NOT EXISTS "login_logs_email_idx" ON "login_logs"("email");
