-- Backfill script for existing budget requests
-- This script assigns company_id to existing budget requests based on user's company access

-- Update budget requests to use the first company the user has access to
UPDATE budget_requests br
SET company_id = (
  SELECT unnest(ucp.company_ids)
  FROM user_company_permissions ucp
  WHERE ucp.user_id = br.user_id
  LIMIT 1
)
WHERE br.company_id IS NULL;

-- Verify all budget requests have company_id
SELECT 
  br.id,
  u.name as user_name,
  c.name as company_name,
  br.requested_amount,
  br.status,
  br.created_at
FROM budget_requests br
LEFT JOIN users u ON br.user_id = u.id
LEFT JOIN companies c ON br.company_id = c.id
WHERE br.company_id IS NULL;

-- If there are any NULL company_ids, you may need to manually assign them or delete those requests
