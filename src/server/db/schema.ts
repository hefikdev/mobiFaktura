import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const userRoleEnum = pgEnum("user_role", ["user", "accountant", "admin"]);
export const invoiceStatusEnum = pgEnum("invoice_status", [
  "pending",
  "in_review",
  "accepted",
  "rejected",
]);

// Users table
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").notNull().default("user"),
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
  
  // File storage
  imageKey: text("image_key").notNull(), // MinIO object key
  
  // User-provided data
  invoiceNumber: varchar("invoice_number", { length: 100 }).notNull(),
  ksefNumber: varchar("ksef_number", { length: 100 }), // KSEF number (letters and numbers)
  description: text("description"),
  justification: text("justification"), // Reason for invoice submission
  
  // Review workflow
  status: invoiceStatusEnum("status").notNull().default("pending"),
  reviewedBy: uuid("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"), // Reason for rejection (visible to user)
  currentReviewer: uuid("current_reviewer").references(() => users.id),
  reviewStartedAt: timestamp("review_started_at", { withTimezone: true }),
  lastReviewPing: timestamp("last_review_ping", { withTimezone: true }), // Heartbeat for active review
  
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  invoices: many(invoices),
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const companiesRelations = relations(companies, ({ many }) => ({
  invoices: many(invoices),
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
  editHistory: many(invoiceEditHistory),
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
export type LoginLog = typeof loginLogs.$inferSelect;
export type NewLoginLog = typeof loginLogs.$inferInsert;
export type UserRole = "user" | "accountant" | "admin";
export type InvoiceStatus = "pending" | "in_review" | "accepted" | "rejected";
