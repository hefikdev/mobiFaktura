-- Migration: cleanup budget_requests columns and extend advances tracking
ALTER TABLE "budget_requests" DROP COLUMN IF EXISTS "transfer_number";
ALTER TABLE "budget_requests" DROP COLUMN IF EXISTS "transfer_date";
ALTER TABLE "budget_requests" DROP COLUMN IF EXISTS "transfer_confirmed_by";
ALTER TABLE "budget_requests" DROP COLUMN IF EXISTS "transfer_confirmed_at";
ALTER TABLE "budget_requests" DROP COLUMN IF EXISTS "settled_at";
ALTER TABLE "budget_requests" DROP COLUMN IF EXISTS "settled_by";
DROP INDEX IF EXISTS "idx_budget_requests_settled_at";

ALTER TABLE IF EXISTS "advances" ADD COLUMN IF NOT EXISTS "transfer_number" varchar(255);
ALTER TABLE IF EXISTS "advances" ADD COLUMN IF NOT EXISTS "transfer_confirmed_by" uuid;
ALTER TABLE IF EXISTS "advances" ADD COLUMN IF NOT EXISTS "transfer_confirmed_at" timestamp with time zone;
ALTER TABLE IF EXISTS "advances" ADD COLUMN IF NOT EXISTS "settled_by" uuid;

ALTER TABLE IF EXISTS "zaliczki" ADD COLUMN IF NOT EXISTS "transfer_number" varchar(255);
ALTER TABLE IF EXISTS "zaliczki" ADD COLUMN IF NOT EXISTS "transfer_confirmed_by" uuid;
ALTER TABLE IF EXISTS "zaliczki" ADD COLUMN IF NOT EXISTS "transfer_confirmed_at" timestamp with time zone;
ALTER TABLE IF EXISTS "zaliczki" ADD COLUMN IF NOT EXISTS "settled_by" uuid;

DO $$
BEGIN
  IF to_regclass('public.advances') IS NOT NULL THEN
    BEGIN
      ALTER TABLE "advances" ADD CONSTRAINT "advances_transfer_confirmed_by_users_id_fk" FOREIGN KEY ("transfer_confirmed_by") REFERENCES "public"."users"("id");
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;

    BEGIN
      ALTER TABLE "advances" ADD CONSTRAINT "advances_settled_by_users_id_fk" FOREIGN KEY ("settled_by") REFERENCES "public"."users"("id");
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;
  END IF;

  IF to_regclass('public.zaliczki') IS NOT NULL THEN
    BEGIN
      ALTER TABLE "zaliczki" ADD CONSTRAINT "zaliczki_transfer_confirmed_by_users_id_fk" FOREIGN KEY ("transfer_confirmed_by") REFERENCES "public"."users"("id");
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;

    BEGIN
      ALTER TABLE "zaliczki" ADD CONSTRAINT "zaliczki_settled_by_users_id_fk" FOREIGN KEY ("settled_by") REFERENCES "public"."users"("id");
    EXCEPTION
      WHEN duplicate_object THEN null;
    END;
  END IF;
END $$;
