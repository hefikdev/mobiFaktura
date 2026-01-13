-- Add company_id to budget_requests table (nullable first to handle existing data)
ALTER TABLE budget_requests ADD COLUMN company_id uuid REFERENCES companies(id) ON DELETE CASCADE;

-- For existing budget requests, set company_id to the first company the user has access to
-- This is a temporary solution - ideally admins should review these
UPDATE budget_requests br
SET company_id = (
  SELECT unnest(ucp.company_ids)
  FROM user_company_permissions ucp
  WHERE ucp.user_id = br.user_id
  LIMIT 1
)
WHERE br.company_id IS NULL;

-- If any budget requests still don't have a company_id (users with no company access),
-- we'll need to handle those separately or they'll be deleted when we make the column required
-- For now, let's just set them to NULL and let the admin handle it

-- Now make the column NOT NULL (after we've filled in values)
ALTER TABLE budget_requests ALTER COLUMN company_id SET NOT NULL;

-- Add index for faster queries by company_id
CREATE INDEX idx_budget_requests_company_id ON budget_requests(company_id);

-- Add index for composite queries
CREATE INDEX idx_budget_requests_user_company ON budget_requests(user_id, company_id);
