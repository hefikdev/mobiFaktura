-- Migration: Add user_company_permissions table
-- Description: Allows admins to grant users permission to specific companies
-- Uses array of company IDs for simple and efficient permission management

CREATE TABLE IF NOT EXISTS user_company_permissions (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    company_ids UUID[] NOT NULL DEFAULT '{}'
);

-- Index for performance on array column
CREATE INDEX IF NOT EXISTS idx_user_company_permissions_company_ids ON user_company_permissions USING GIN(company_ids);

-- Comment
COMMENT ON TABLE user_company_permissions IS 'Stores array of company IDs each user has permission to access';
COMMENT ON COLUMN user_company_permissions.company_ids IS 'Array of company UUIDs the user can access';
