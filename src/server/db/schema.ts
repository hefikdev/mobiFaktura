import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
  pgEnum,
  numeric,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["user", "accountant", "admin"]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "in_review",
  "accepted",
  "transferred",
  "settled",
  "rejected",
]);
export const invoiceTypeEnum = pgEnum("invoice_type", [
  "einvoice",
  "receipt",
  "correction",
]);
export const notificationTypeEnum = pgEnum("notification_type", [
  "invoice_accepted",
  "invoice_rejected",
  "invoice_submitted",
  "invoice_assigned",
  "budget_request_submitted",
  "budget_request_approved",
  "budget_request_rejected",
  "saldo_adjusted",
  "system_message",
  "company_updated",
  "password_changed",
]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("user"),
  notificationSound: boolean("notification_sound").notNull().default(true),
  notificationInvoiceAccepted: boolean("notification_invoice_accepted").notNull().default(true),
  notificationInvoiceRejected: boolean("notification_invoice_rejected").notNull().default(true),
  notificationInvoiceSubmitted: boolean("notification_invoice_submitted").notNull().default(true),
  notificationInvoiceAssigned: boolean("notification_invoice_assigned").notNull().default(true),
  notificationBudgetRequestSubmitted: boolean("notification_budget_request_submitted").notNull().default(true),
  notificationBudgetRequestApproved: boolean("notification_budget_request_approved").notNull().default(true),
  notificationBudgetRequestRejected: boolean("notification_budget_request_rejected").notNull().default(true),
  notificationSaldoAdjusted: boolean("notification_saldo_adjusted").notNull().default(true),
  notificationSystemMessage: boolean("notification_system_message").notNull().default(true),
  notificationCompanyUpdated: boolean("notification_company_updated").notNull().default(true),
  notificationPasswordChanged: boolean("notification_password_changed").notNull().default(true),
  saldo: numeric("saldo", { precision: 12, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Sessions table for secure session management
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Companies table
export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  nip: varchar("nip", { length: 20 }),
  address: text("address"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  // Per-company budget field (ready for future implementation)
  // When implementing: uncomment this field, create migration, migrate user.saldo to company.saldo
  // saldo: numeric("saldo", { precision: 12, scale: 2 }).default("0.00"),
});

// Invoices table
export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "restrict" }),
  
  // Invoice type
  invoiceType: invoiceTypeEnum("invoice_type").notNull().default("einvoice"),
  
  // File storage
  imageKey: text("image_key").notNull(), // MinIO object key
  
  // User-provided data
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
  ksefNumber: varchar("ksef_number", { length: 100 }), // KSEF number (letters and numbers) - only for einvoice
  kwota: numeric("kwota", { precision: 12, scale: 2 }), // Invoice amount
  description: text("description"),
  justification: text("justification"), // Reason for invoice submission
  
  // Correction invoice fields
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  originalInvoiceId: uuid("original_invoice_id").references((): any => invoices.id, { onDelete: "restrict" }), // For correction invoices
  correctionAmount: numeric("correction_amount", { precision: 12, scale: 2 }), // Positive amount for corrections
  
  // Review workflow
  status: invoiceStatusEnum("status").notNull().default("pending"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"), // Reason for rejection (visible to user)
  currentReviewer: uuid("current_reviewer").references(() => users.id),
  reviewStartedAt: timestamp("review_started_at", { withTimezone: true }),
  lastReviewPing: timestamp("last_review_ping", { withTimezone: true }), // Heartbeat for active review
  
    // Payment tracking
  transferredBy: uuid("transferred_by").references(() => users.id),
  transferredAt: timestamp("transferred_at", { withTimezone: true }),
  settledBy: uuid("settled_by").references(() => users.id),
  settledAt: timestamp("settled_at", { withTimezone: true }),
    budgetRequestId: uuid("budget_request_id").references(() => budgetRequests.id, { onDelete: "set null" }),
    advanceId: uuid("zaliczka_id").references(() => advances.id, { onDelete: "set null" }),
  
  // Tracking
  lastEditedBy: uuid("last_edited_by").references(() => users.id),
  lastEditedAt: timestamp("last_edited_at", { withTimezone: true }),
  
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Invoice Edit History table
export const invoiceEditHistory = pgTable("invoice_edit_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  editedBy: uuid("edited_by")
    .notNull()
    .references(() => users.id),
  previousInvoiceNumber: varchar("previous_invoice_number", { length: 100 }),
  newInvoiceNumber: varchar("new_invoice_number", { length: 100 }),
  previousDescription: text("previous_description"),
  newDescription: text("new_description"),
  editedAt: timestamp("edited_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Invoice Action Logs table (audit trail)
export const invoiceActionLogs = pgTable("invoice_action_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 100 }).notNull(),
  performedBy: uuid("performed_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  invoiceIdIdx: index("invoice_action_logs_invoice_id_idx").on(table.invoiceId),
  performedByIdx: index("invoice_action_logs_performed_by_idx").on(table.performedBy),
  createdAtIdx: index("invoice_action_logs_created_at_idx").on(table.createdAt),
}));

// Login Logs table
export const loginLogs = pgTable("login_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }), // IPv6 max length
  success: boolean("success").notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // null if failed login
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Login Attempts table (for security tracking)
export const loginAttempts = pgTable("login_attempts", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: varchar("identifier", { length: 255 }).notNull(), // email or IP address
  attemptCount: varchar("attempt_count", { length: 10 }).notNull().default("0"),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").references(() => companies.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  readAt: timestamp("read_at", { withTimezone: true }),
});

// Saldo Transactions table - tracks all balance changes
export const saldoTransactions = pgTable("saldo_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  balanceBefore: numeric("balance_before", { precision: 12, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 12, scale: 2 }).notNull(),
  transactionType: varchar("transaction_type", { length: 50 }).notNull(), // 'adjustment', 'invoice_deduction', 'invoice_refund', 'advance_credit'
  referenceId: uuid("reference_id"), // invoice id if related to invoice
  notes: text("notes"),
  createdBy: uuid("created_by")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Invoice Deletion Requests table - users/accountants request invoice deletion
export const invoiceDeletionRequests = pgTable("invoice_deletion_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  invoiceId: uuid("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  requestedBy: uuid("requested_by")
    .notNull()
    .references(() => users.id),
  reason: text("reason").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'approved', 'rejected'
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  statusIdx: index("idx_deletion_requests_status").on(table.status),
  invoiceIdx: index("idx_deletion_requests_invoice").on(table.invoiceId),
}));

// Budget Requests table - users request budget increases
export const budgetRequests = pgTable("budget_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  requestedAmount: numeric("requested_amount", { precision: 12, scale: 2 }).notNull(),
  currentBalanceAtRequest: numeric("current_balance_at_request", { precision: 12, scale: 2 }).notNull(),
  justification: text("justification").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'approved', 'rejected'
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => ({
  companyIdIdx: index("idx_budget_requests_company_id").on(table.companyId),
  userCompanyIdx: index("idx_budget_requests_user_company").on(table.userId, table.companyId),
}));

// Advances table (DB table name preserved as "zaliczki")
export const advances = pgTable("zaliczki", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id").notNull().references(() => companies.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"), // 'pending', 'transferred', 'settled'
  sourceType: varchar("source_type", { length: 50 }).notNull(), // 'budget_request', 'manual'
  sourceId: uuid("source_id"), // Can be budgetRequestId or null
  description: text("description"),
  transferNumber: varchar("transfer_number", { length: 255 }),
  transferDate: timestamp("transfer_date", { withTimezone: true }),
  transferConfirmedBy: uuid("transfer_confirmed_by").references(() => users.id),
  transferConfirmedAt: timestamp("transfer_confirmed_at", { withTimezone: true }),
  settledAt: timestamp("settled_at", { withTimezone: true }),
  settledBy: uuid("settled_by").references(() => users.id),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index("idx_zaliczki_user_id").on(table.userId),
  statusIdx: index("idx_zaliczki_status").on(table.status),
}));

// User Company Permissions table - controls which users can access which companies
export const userCompanyPermissions = pgTable("user_company_permissions", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  companyIds: uuid("company_ids").array().notNull().default(sql`'{}'`),
}, (table) => ({
  companyIdsIdx: index("idx_user_company_permissions_company_ids").using("gin", table.companyIds),
}));

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  invoices: many(invoices),
  sessions: many(sessions),
  notifications: many(notifications),
  saldoTransactions: many(saldoTransactions),
  budgetRequests: many(budgetRequests),
  advances: many(advances),
  companyPermissions: one(userCompanyPermissions, {
    fields: [users.id],
    references: [userCompanyPermissions.userId],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
  invoice: one(invoices, {
    fields: [notifications.invoiceId],
    references: [invoices.id],
  }),
  company: one(companies, {
    fields: [notifications.companyId],
    references: [companies.id],
  }),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  invoices: many(invoices),
  budgetRequests: many(budgetRequests),
  advances: many(advances),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  user: one(users, {
    fields: [invoices.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [invoices.companyId],
    references: [companies.id],
  }),
  reviewer: one(users, {
    fields: [invoices.reviewedBy],
    references: [users.id],
  }),
  currentReviewer: one(users, {
    fields: [invoices.currentReviewer],
    references: [users.id],
  }),
  lastEditor: one(users, {
    fields: [invoices.lastEditedBy],
    references: [users.id],
  }),
  budgetRequest: one(budgetRequests, {
    fields: [invoices.budgetRequestId],
    references: [budgetRequests.id],
  }),
  advance: one(advances, {
    fields: [invoices.advanceId],
    references: [advances.id],
  }),
  editHistory: many(invoiceEditHistory),
  actionLogs: many(invoiceActionLogs),
}));

export const invoiceEditHistoryRelations = relations(invoiceEditHistory, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceEditHistory.invoiceId],
    references: [invoices.id],
  }),
  editor: one(users, {
    fields: [invoiceEditHistory.editedBy],
    references: [users.id],
  }),
}));

export const invoiceActionLogsRelations = relations(invoiceActionLogs, ({ one }) => ({
  invoice: one(invoices, {
    fields: [invoiceActionLogs.invoiceId],
    references: [invoices.id],
  }),
  actor: one(users, {
    fields: [invoiceActionLogs.performedBy],
    references: [users.id],
  }),
}));

export const saldoTransactionsRelations = relations(saldoTransactions, ({ one }) => ({
  user: one(users, {
    fields: [saldoTransactions.userId],
    references: [users.id],
  }),
  createdByUser: one(users, {
    fields: [saldoTransactions.createdBy],
    references: [users.id],
  }),
  invoice: one(invoices, {
    fields: [saldoTransactions.referenceId],
    references: [invoices.id],
  }),
}));

export const budgetRequestsRelations = relations(budgetRequests, ({ one, many }) => ({
  user: one(users, {
    fields: [budgetRequests.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [budgetRequests.reviewedBy],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [budgetRequests.companyId],
    references: [companies.id],
  }),
  invoices: many(invoices),
}));

export const advancesRelations = relations(advances, ({ one, many }) => ({
  user: one(users, {
    fields: [advances.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [advances.companyId],
    references: [companies.id],
  }),
  creator: one(users, {
    fields: [advances.createdBy],
    references: [users.id],
  }),
  invoices: many(invoices),
}));

export const userCompanyPermissionsRelations = relations(userCompanyPermissions, ({ one }) => ({
  user: one(users, {
    fields: [userCompanyPermissions.userId],
    references: [users.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceEditHistory = typeof invoiceEditHistory.$inferSelect;
export type NewInvoiceEditHistory = typeof invoiceEditHistory.$inferInsert;
export type InvoiceActionLog = typeof invoiceActionLogs.$inferSelect;
export type NewInvoiceActionLog = typeof invoiceActionLogs.$inferInsert;
export type LoginLog = typeof loginLogs.$inferSelect;
export type NewLoginLog = typeof loginLogs.$inferInsert;
export type LoginAttempt = typeof loginAttempts.$inferSelect;
export type NewLoginAttempt = typeof loginAttempts.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type SaldoTransaction = typeof saldoTransactions.$inferSelect;
export type NewSaldoTransaction = typeof saldoTransactions.$inferInsert;
export type BudgetRequest = typeof budgetRequests.$inferSelect;
export type NewBudgetRequest = typeof budgetRequests.$inferInsert;
export type UserCompanyPermission = typeof userCompanyPermissions.$inferSelect;
export type NewUserCompanyPermission = typeof userCompanyPermissions.$inferInsert;
export type UserRole = "user" | "accountant" | "admin";
export type InvoiceStatus = "pending" | "in_review" | "accepted" | "rejected";
export type InvoiceType = "einvoice" | "receipt" | "correction";
export type NotificationType = "invoice_accepted" | "invoice_rejected" | "invoice_submitted" | "invoice_assigned" | "budget_request_submitted" | "budget_request_approved" | "budget_request_rejected" | "saldo_adjusted" | "system_message" | "company_updated" | "password_changed";
export type SaldoTransactionType = "adjustment" | "invoice_deduction" | "invoice_refund" | "advance_credit" | "invoice_delete_refund";
export type BudgetRequestStatus = "pending" | "approved" | "rejected";
