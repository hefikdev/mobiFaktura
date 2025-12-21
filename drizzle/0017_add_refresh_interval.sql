-- Add refresh_interval column to users table
ALTER TABLE "users" ADD COLUMN "refresh_interval" integer NOT NULL DEFAULT 1000;
