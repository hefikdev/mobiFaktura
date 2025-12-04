-- Create login_attempts table for rate limiting
CREATE TABLE IF NOT EXISTS "login_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"attempt_count" varchar(10) DEFAULT '0' NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create index on identifier for faster lookups
CREATE INDEX IF NOT EXISTS "login_attempts_identifier_idx" ON "login_attempts" ("identifier");
