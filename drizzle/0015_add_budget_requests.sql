-- Migration: Add budget request system
-- Users can request budget increases, accountants approve/reject

CREATE TABLE IF NOT EXISTS "budget_requests" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "requested_amount" numeric(12, 2) NOT NULL,
    "justification" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    "reviewed_by" UUID REFERENCES "users"("id"),
    "reviewed_at" TIMESTAMP WITH TIME ZONE,
    "rejection_reason" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX "idx_budget_requests_user_id" ON "budget_requests"("user_id");
CREATE INDEX "idx_budget_requests_status" ON "budget_requests"("status");
CREATE INDEX "idx_budget_requests_created_at" ON "budget_requests"("created_at" DESC);

-- Add comment for documentation
COMMENT ON TABLE "budget_requests" IS 'User budget increase requests that require accountant approval';
