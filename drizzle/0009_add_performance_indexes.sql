-- Add indexes for optimized query performance

-- Index on invoices.userId for faster user-specific queries (myInvoices)
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);

-- Index on invoices.status for faster status filtering (pending, accepted, rejected)
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

-- Composite index for accountant queries (status + createdAt for efficient sorting)
CREATE INDEX IF NOT EXISTS idx_invoices_status_created_at ON invoices(status, created_at DESC);

-- Index on invoices.reviewedAt for faster reviewed invoices queries
CREATE INDEX IF NOT EXISTS idx_invoices_reviewed_at ON invoices(reviewed_at DESC);

-- Index on invoices.companyId for company filtering
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);

-- Index on loginLogs.createdAt for date range queries
CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at DESC);

-- Index on loginLogs.userId for user-specific log queries
CREATE INDEX IF NOT EXISTS idx_login_logs_user_id ON login_logs(user_id);

-- Composite index for login logs filtering (userId + createdAt)
CREATE INDEX IF NOT EXISTS idx_login_logs_user_created ON login_logs(user_id, created_at DESC);

-- Index on users.role for role-based queries
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Index on users.createdAt for sorting users by creation date
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- Index on invoiceEditHistory.invoiceId for faster edit history lookup
CREATE INDEX IF NOT EXISTS idx_invoice_edit_history_invoice_id ON invoice_edit_history(invoice_id, edited_at DESC);

-- Index on sessions.userId for faster session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Index on sessions.expiresAt for cleanup queries
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Index for stale review detection (status + lastReviewPing)
CREATE INDEX IF NOT EXISTS idx_invoices_in_review_ping ON invoices(status, last_review_ping) WHERE status = 'in_review';
