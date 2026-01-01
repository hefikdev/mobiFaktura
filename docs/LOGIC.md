# mobiFaktura — App Logic (Up-to-date)

> This document summarizes the current application logic, main flows, user scenarios, and fallbacks. It is intended as an operational reference for devs and reviewers.

---

## Table of Contents
- Overview ✅
- Roles & Access Control 🔐
- Key Data Models & Types 🗂️
- Core Flows
  - Budget Request (request → approve → settle/rozliczono / reject) 🧾
  - Invoices (submit → assign → accept/reject → re-review) 🧾
  - Saldo (transactions and rollbacks) 💳
  - Notifications (in-app + PWA push plan) 🔔
  - Admin features (bulk delete, system notifications) 🛠️
- Concurrency, Transactions & Fallbacks ⚖️
- Error handling & edge cases ⚠️
- Migrations & DB sync notes 🗃️
- Testing & monitoring 📊
- Open recommendations / TODOs ✍️

---

## Overview ✅
mobiFaktura is a small finance workflow system that supports submitting invoices and budget increase requests, managing balances (saldo), and notifying users. Core principles:
- Strong role separation: users, accountants, admins
- Database-backed authoritative state (Postgres via Drizzle)
- Notifications for critical state changes
- PWA-ready frontend with service worker

---

## Roles & Access Control 🔐
- **user**: create invoices, request budgets, view own history
- **accountant**: review and process invoices and budget requests
- **admin**: system actions (bulk deletes, system notifications), user management

Access rules are enforced server-side in TRPC procedures that require specific role procedures: `protectedProcedure`, `accountantProcedure`, `adminProcedure`.

---

## Key Data Models & Types 🗂️
- `users` — holds profile, preferences, `saldo`, notification preferences
- `invoices` — invoice details, `status` (pending, in_review, accepted, rejected, re_review), `ksefNumber`, image references
- `budget_requests` — budget increase requests: `status` (pending, approved, rejected, rozliczono), `requested_amount`, `reviewedAt`, `reviewedBy`, `rejectionReason`
- `notifications` — system/app notifications stored per user
- `saldo_transactions` — ledger of adjustments (references invoices and requests)

Type aliases in `src/server/db/schema.ts` reflect these strings; keep them in sync when adding statuses like `rozliczono`.

---

## Core Flows

### Budget Request — Create → Approve → (Rozliczono) / Reject 🧾
1. User calls `budgetRequest.create`:
   - Validation: `requestedAmount > 0`, justification length, ensures user has no existing `pending` request.
   - Persists a `budget_requests` row (status `pending`) with `currentBalanceAtRequest`.
   - Notifies accountants via `notifyBudgetRequestSubmitted`.

2. Accountant reviews via UI dialog (server `budgetRequest.review`):
   - Actions: `approve` or `reject`.
   - Approve (transactional):
     - Start DB transaction.
     - Update `users.saldo` (increase by requestedAmount) with verification.
     - Insert `saldo_transactions` with `referenceId` pointing to the budget request.
     - Update `budget_requests` to `approved`, set `reviewedAt`, `reviewedBy` (concurrent check: previous status must be `pending`).
     - If any step fails, transaction rolls back; front-end shows error.
     - After commit, send `notifyBudgetRequestApproved` to user.
   - Reject:
     - Update `budget_requests` to `rejected`, set `rejectionReason`, `reviewedAt`, `reviewedBy`.
     - Send `notifyBudgetRequestRejected`.
   - Concurrency: if another accountant already changed the request, router returns `CONFLICT`.

3. Settle (Rozliczono) — new flow:
   - Action `settle` (accountantProcedure) is available on approved requests.
   - Behavior:
     - Verify request exists and `status === "approved"`.
     - Update `status` to `rozliczono` and `updatedAt` (consider adding a `settledAt` column - recommended).
     - Create a system notification for the user indicating settlement.
   - Rationale: marks the request as finalized (no further saldo changes expected for that request).

4. UI support:
   - Pending: show Approve/Reject buttons in table and unified dialog.
   - Approved: show `Rozlicz` button (opens dialog in `settle` mode) — this triggers `budgetRequest.settle`.
   - Details dialog also lists `Powiązane faktury` (invoices created between `reviewedAt` and settlement or now).

**Fallbacks & Edge Cases**
- If the approve transaction fails after updating saldo, the DB transaction rolls back and user is notified of failure.
- If `approve` is attempted while another processor already changed the status, the router returns `CONFLICT` and UI asks to refresh.
- `settle` rejects if request not `approved`.

---

#### Visual (ASCII) — Budget Request Flow

Use the ASCII diagrams below in environments that do not render Mermaid. They are intentionally simple and use spacing and arrows for clarity.

Flow (high level):

  User
   |
   | create request (pending)
   v
  Server (budgetRequest.create)
   |
   | save request -> budget_requests (pending)
   | notify accountants
   v
  Accountant UI
   |-- approve --> Server (budgetRequest.review)
   |               |
   |               | transaction:
   |               |  - update users.saldo
   |               |  - insert saldo_transactions
   |               |  - set budget_requests -> approved (reviewedAt)
   |               v
   |            DB (users, saldo_transactions, budget_requests)
   |-- reject --> Server (update budget_requests -> rejected)
   |
   |-- settle (rozliczono) --> Server (budgetRequest.settle)
                   |
                   | update budget_requests -> rozliczono (settledAt)
                   v
                 DB

Sequence (condensed):

  [User] -> [Server]: create request (pending)
  [Server] -> [DB]: insert budget_requests
  [Server] -> [Accountants]: notify
  [Accountant] -> [Server]: approve
  [Server] -> [DB]: transaction (update saldo, insert saldo_transactions, update request)
  [Server] -> [User]: notify
  [Accountant] -> [Server]: settle
  [Server] -> [DB]: update request settledAt

Note: For exact invoice ↔ budget request relation, consider adding a linking table `budget_request_invoices`.

---

### Invoice Flow 🧾
- Submit invoice (user): stored with `status = pending`.
- Assign to accountant(s) and notify via `notifyInvoiceSubmitted`.
- Accountant reviews and may `accept` (deducts amount from user's `saldo` and records `saldo_transactions`) or `reject` (set `status = rejected`, provide reason).
- Re-review flow: allowed for `accepted` or `rejected` via `re_review` status and special flow.

Rollbacks:
- If invoice acceptance fails while adjusting saldo, the transaction rolls back and the invoice creation/acceptance fails.
- If an accepted invoice is later rejected, system uses `saldo_transactions` to refund the user (or otherwise apply reversal logic).

---

### Saldo (Balance) 💳
- All changes to `users.saldo` are recorded in `saldo_transactions` with `balanceBefore`, `balanceAfter`, `transactionType` and `referenceId` referencing invoice or budget request.
- Important behaviors:
  - Use database transactions when modifying `saldo` and inserting to `saldo_transactions` to keep atomicity.
  - For invoice acceptance, `transactionType = invoice_deduction`; for refunds or rollbacks, `invoice_refund`.
  - For budget approvals, `transactionType = zasilenie` (top-up) and reference the budget request id.

---

### Notifications 🔔
- **In-app notifications** are created with `createNotification()` and stored in `notifications` table.
- Notification UI pulls `getAll` and `getUnreadCount`; bell shows unread count and optional sound on new notifications.
- **Push (PWA) plan (recommended)**:
  - Add subscription model table (store endpoint, keys, userId). Generate VAPID keys server-side.
  - Frontend: request permission, subscribe via `ServiceWorkerRegistration.pushManager.subscribe()` and send subscription to API.
  - Server: send web push using `web-push` with VAPID and payloads on notification creation.
  - Fallbacks: when push fails (subscription invalid/expired), mark subscription invalid and fallback to in-app notification only.
- Admin feature `sendSystemNotification` creates system messages for selected roles.

---

## Admin Features 🛠️
- **Bulk delete budget requests** (admin/unlimited op): protected via admin password verification.
  - Filterable by user, date range, status (now includes `rozliczono`), year/month, olderThanMonths.
  - Validation prevents accidental deletes (confirmation password step).
- **System notifications**: admins can send system messages (targets by role).

---

## Concurrency, Transactions & Fallbacks ⚖️
- Use DB transactions when multiple related updates are required (e.g., adjust user saldo + insert saldo_transactions + update request status).
- Use optimistic locking where appropriate (compare `updatedAt` timestamps for concurrency-sensitive operations).
- For long-running or batch operations, perform work in transactions or chunked batches with progress logs and retry/fallback behavior.
- Important rollback cases:
  - Failed transaction should return `INTERNAL_SERVER_ERROR` and not leave partial state.
  - For operations that modify external systems (e.g., MinIO file upload), perform compensating actions on failure.

---

## Error Handling & Edge Cases ⚠️
- Always validate inputs server-side (Zod schemas in TRPC routers).
- Return specific TRPCErrors: `BAD_REQUEST`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `UNAUTHORIZED` as appropriate.
- Race conditions: respond to clients with `CONFLICT` and instruct to refresh.
- Notification delivery failures: log and mark invalid subscriptions.

---

## Migrations & DB Sync 🗃️
- Project uses Drizzle with migration files in `drizzle/` and a migration journal in `drizzle/meta/_journal.json`.
- Important notes:
  - `db:migrate` runs migration files sequentially and will fail if the DB already has the change (column exists).
  - `db:push` can be used to sync schema when the DB already matches the model (non-destructive sync).
  - If a migration fails because schema was changed manually, inspect the migrations journal and use `push` or fix migrations.

---

## Testing & Monitoring 📊
- Unit tests exist under `tests/unit` (notifications, saldo logic, budget-request logic).
- Add integration tests for:
  - Approve/reject/settle flows including DB transactions
  - Push notification subscription and send
  - Bulk delete filters and password verification
- Logging: capture important events (errors, failed transactions, notification failures) and surface to monitoring.

---

## UX & UI Notes
- Unified **BudgetRequestReviewDialog** supports `review`, `details`, and `settle` modes.
- Table now shows `Data złożenia` and `Data decyzji` columns (decision date is `reviewedAt`), and a `Rozlicz` button for approved requests.
- Dialog shows related invoices with quick links to invoice pages. (Fixed a PWA/Next.js hydration issue where nested <a> tags caused "In HTML, <a> cannot be a descendant of <a>" — use `Button asChild` with an inner `Link` to avoid nested anchors.)

---

## Scenarios & Step-by-step (with fallbacks)

### Scenario A — User requests budget → Accountant approves → All OK
1. User creates request `pending`.
2. Accountant opens dialog → click Approve.
3. Server transaction:
   - Increase user saldo
   - Insert saldo_transactions
   - Update request status to `approved` with `reviewedAt` and `reviewedBy`.
4. Notify user (in-app and push if available).
5. UI shows request as `Zaakceptowana` and `Rozlicz` action available later.

Fallbacks:
- If DB transaction fails: rollback, return error to accountant, no saldo change.
- If notification send fails: log and fall back to only creating DB notification.

### Scenario B — Approve attempted concurrently by two accountants
- First transaction commits successfully; second attempt sees `request.status !== 'pending'` and returns `CONFLICT`.
- UI refreshes and informs accountant to reload.

### Scenario C — Accountant settles (rozliczono)
1. Accountant clicks `Rozlicz` on an `approved` request.
2. Server verifies `approved`, updates `status` to `rozliczono` and `updatedAt`.
3. Optionally notify user and mark `settledAt` (recommended to add explicit column).

Fallbacks:
- If `settle` called on non-approved state: return `BAD_REQUEST`.

### Scenario D — Show related invoices
- Dialog queries `getRelatedInvoices` which selects invoices for the same user created between `reviewedAt` and `settledAt` (or now if not settled).
- This is a heuristic: for exact matching, add explicit `budget_request_invoice` link table when invoices are used to settle requests.

---

## Open recommendations / TODOs ✍️
- Add `settledAt` (timestamp) column to `budget_requests` to record explicit settlement date/time. (Implemented in migration `0022_add_settled_at.sql` and set by `budgetRequest.settle`)
- Add explicit invoice↔budget_request linking if invoices are sometimes directly used to settle budgets.
- Implement Web Push with a `push_subscriptions` table and VAPID keys; add subscription lifecycle maintenance (remove invalid subs).
- Add integration tests for settle flow and related invoices query.

---

### Helpful Commands
- Run dev server: `npm run dev`
- Schema sync: `npm run db:push` (safe when DB already matches)
- Run migrations: `npm run db:migrate`
- Run tests: `npm run test` or `npm run test:run`

---

If you'd like, I can:
- Add `settledAt` migration + update code to set `settledAt` during `settle` action ✅ (recommended), or
- Expand the scenarios with sequence diagrams or code pointers for each step.


---

_Last updated: 2026-01-01 — generated from current repo state._
