# mobiFaktura - API Documentation

**Version:** 1.0  
**Last Updated:** January 29, 2026  
**API Type:** tRPC (Type-safe RPC)

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Routers](#api-routers)
4. [Common Patterns](#common-patterns)
5. [Error Handling](#error-handling)
6. [Rate Limiting](#rate-limiting)

---

## Overview

mobiFaktura uses [tRPC](https://trpc.io/) for end-to-end type-safe API communication between the Next.js frontend and backend. This means:

- **Full TypeScript inference**: No need to manually define types
- **Runtime validation**: Zod schemas validate all inputs
- **Automatic serialization**: Dates, BigInts handled automatically
- **Built-in error handling**: Structured error responses

### API Structure

```
/api/trpc/[trpc]
└── appRouter
    ├── auth          - Authentication & sessions
    ├── invoice       - Invoice management
    ├── company       - Company operations
    ├── admin         - Admin functions
    ├── notification  - Notification system
    ├── saldo         - Balance transactions
    ├── budgetRequest - Budget requests
    ├── ksef          - KSeF integration
    ├── permissions   - User-company permissions
    ├── advances      - Advance payments
    └── exports       - Report generation
```

### Procedure Types

- **Public Procedure**: No authentication required
- **Protected Procedure**: Must be logged in
- **User Procedure**: Must be logged in as user role
- **Accountant Procedure**: Must be accountant or admin
- **Admin Procedure**: Must be admin

---

## Authentication

### Auth Router (`auth`)

#### `auth.login`
**Type:** Public Procedure (Mutation)  
**Purpose:** Authenticate user and create session

**Input:**
```typescript
{
  email: string;      // User email
  password: string;   // Plain text password
}
```

**Output:**
```typescript
{
  success: true;
  user: {
    id: string;
    email: string;
    name: string;
    role: "user" | "accountant" | "admin";
  };
}
```

**Errors:**
- `UNAUTHORIZED`: Invalid credentials
- `FORBIDDEN`: Account locked (3 failed attempts)
- `TOO_MANY_REQUESTS`: Rate limited

**Side Effects:**
- Creates session in database
- Sets httpOnly cookie with JWT
- Records login log
- Clears failed login attempts on success

---

#### `auth.logout`
**Type:** Protected Procedure (Mutation)  
**Purpose:** End user session

**Input:** None

**Output:**
```typescript
{
  success: true;
}
```

**Side Effects:**
- Deletes session from database
- Clears session cookie
- Logs logout event

---

#### `auth.me`
**Type:** Protected Procedure (Query)  
**Purpose:** Get current user information

**Input:** None

**Output:**
```typescript
{
  id: string;
  email: string;
  name: string;
  role: "user" | "accountant" | "admin";
  saldo: string;                    // Numeric string (e.g., "1234.56")
  notificationSound: boolean;
  notificationInvoiceAccepted: boolean;
  // ... all notification preferences
  createdAt: Date;
  updatedAt: Date;
}
```

**Caching:** Heavily cached on client side

---

#### `auth.changePassword`
**Type:** Protected Procedure (Mutation)  
**Purpose:** Change user password

**Input:**
```typescript
{
  currentPassword: string;
  newPassword: string;
}
```

**Validation:**
- Current password must match
- New password: min 8 chars, uppercase, lowercase, number, special char
- Cannot reuse old password

**Side Effects:**
- Updates password hash (Argon2id)
- Invalidates all other sessions
- Sends password changed notification
- Logs password change event

---

## Invoice Router (`invoice`)

### Invoice Management

#### `invoice.create`
**Type:** Protected Procedure (Mutation)  
**Purpose:** Create new invoice

**Input:**
```typescript
{
  imageDataUrl: string;              // Base64 data URL
  invoiceNumber: string;             // Max 100 chars
  invoiceType: "einvoice" | "receipt";
  ksefNumber?: string;               // Optional, max 100 chars
  kwota?: number;                    // Optional, positive
  companyId: string;                 // UUID
  justification: string;             // 10-2000 chars
  budgetRequestId?: string;          // Optional UUID
}
```

**Validation:**
- User must have permission for company
- Receipts cannot have KSeF number
- Budget request must exist and not be rejected
- Company must be active
- Image must be valid format

**Side Effects:**
- Compresses and uploads image to MinIO
- Creates invoice record with status "pending"
- Notifies accountants
- Links to budget request if provided
- Records action in audit log

**Output:**
```typescript
{
  id: string;              // Invoice UUID
  invoiceNumber: string;
  status: "pending";
}
```

---

#### `invoice.getById`
**Type:** Protected Procedure (Query)  
**Purpose:** Get detailed invoice information

**Input:**
```typescript
{
  id: string;              // Invoice UUID
  claimReview?: boolean;   // Auto-claim for review (accountant only)
}
```

**Output:**
```typescript
{
  id: string;
  invoiceNumber: string;
  imageKey: string;
  imageUrl: string;              // Presigned URL (15 min expiry)
  status: InvoiceStatus;
  invoiceType: "einvoice" | "receipt" | "correction" | null;
  ksefNumber: string | null;
  kwota: string | null;          // Numeric string
  description: string | null;
  originalInvoiceId: string | null;
  correctionAmount: string | null;
  justification: string | null;
  userId: string;
  userName: string;
  userEmail: string;
  companyId: string;
  companyName: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  reviewerName: string | null;
  rejectionReason: string | null;
  transferredBy: string | null;
  transferredAt: Date | null;
  transferrerName: string | null;
  settledBy: string | null;
  settledAt: Date | null;
  settlerName: string | null;
  createdAt: Date;
  updatedAt: Date;
  budgetRequest?: {
    id: string;
    requestedAmount: number;
    status: string;
    // ... more fields
  };
}
```

**Authorization:**
- Users can only see their own invoices (unless accountant/admin)
- Accountants/admins can see all invoices

---

#### `invoice.getAll`
**Type:** Protected Procedure (Infinite Query)  
**Purpose:** Get paginated list of invoices

**Input:**
```typescript
{
  status?: InvoiceStatus;      // Filter by status
  limit?: number;              // Default 50, max 100
  cursor?: string;             // For pagination
}
```

**Output:**
```typescript
{
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    companyId: string;
    companyName: string;
    userId: string;
    userName: string;
    userEmail: string;
    ksefNumber: string | null;
    kwota: string | null;
    status: InvoiceStatus;
    invoiceType: InvoiceType | null;
    description: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    reviewerName: string | null;
    createdAt: Date;
    budgetRequest: {
      id: string;
      requestedAmount: number;
      status: string;
    } | null;
  }>;
  nextCursor?: string;         // For next page
}
```

**Authorization:**
- Users see only their own invoices
- Accountants/admins see all invoices
- Filtered by company permissions (users only)

---

#### `invoice.claimForReview`
**Type:** Accountant Procedure (Mutation)  
**Purpose:** Claim invoice for review

**Input:**
```typescript
{
  id: string;    // Invoice UUID
}
```

**Validation:**
- Invoice must be in "pending" status
- Not already claimed by another accountant

**Side Effects:**
- Updates status to "in_review"
- Sets reviewedBy to current user
- Sets reviewedAt timestamp
- Sends notification to user

---

#### `invoice.acceptInvoice`
**Type:** Accountant Procedure (Mutation)  
**Purpose:** Accept invoice and update user balance

**Input:**
```typescript
{
  id: string;            // Invoice UUID
  comment?: string;      // Optional comment
}
```

**Validation:**
- Invoice must be in "in_review" status
- Must have kwota (amount)
- User must exist

**Transaction:**
1. Update invoice status to "accepted"
2. Increase user saldo by invoice amount
3. Create saldo transaction record
4. Update reviewedAt and reviewedBy
5. Commit or rollback on error

**Side Effects:**
- Sends acceptance notification to user
- Records action in audit log
- Creates edit history entry

---

#### `invoice.rejectInvoice`
**Type:** Accountant Procedure (Mutation)  
**Purpose:** Reject invoice with reason

**Input:**
```typescript
{
  id: string;                  // Invoice UUID
  rejectionReason: string;     // Required, max 1000 chars
}
```

**Validation:**
- Invoice must be in "in_review" status
- Rejection reason required

**Side Effects:**
- Updates status to "rejected"
- Does NOT change user saldo
- Records rejection reason
- Sends notification to user
- Records action in audit log

---

#### `invoice.markAsTransferred`
**Type:** Accountant Procedure (Mutation)  
**Purpose:** Mark accepted invoice as money transferred

**Input:**
```typescript
{
  id: string;    // Invoice UUID
}
```

**Validation:**
- Invoice must be "accepted" status

**Side Effects:**
- Updates status to "transferred"
- Records transferredBy and transferredAt
- Sends notification to user

---

#### `invoice.markAsSettled`
**Type:** Accountant Procedure (Mutation)  
**Purpose:** Mark invoice as settled/reconciled

**Input:**
```typescript
{
  id: string;    // Invoice UUID
}
```

**Validation:**
- Invoice must be "accepted" or "transferred"

**Side Effects:**
- Updates status to "settled"
- Records settledBy and settledAt
- Sends notification to user

---

#### `invoice.createCorrection`
**Type:** Accountant Procedure (Mutation)  
**Purpose:** Create correction invoice

**Input:**
```typescript
{
  originalInvoiceId: string;      // UUID of original invoice
  correctionAmount: string;       // Numeric string (can be negative)
  justification: string;          // 10-2000 chars
  imageDataUrl: string;           // Base64 image data
}
```

**Validation:**
- Original invoice must exist and be accepted
- Justification required (min 10 chars)
- Amount cannot be zero

**Transaction:**
1. Upload correction image
2. Create correction invoice with auto-accepted status
3. Update user saldo by correction amount
4. Create saldo transaction
5. Link to original invoice
6. Set invoice number as "{ORIGINAL}-KOREKTA"

**Side Effects:**
- User balance adjusted automatically
- Notification sent to user
- Audit log created

---

#### `invoice.bulkAccept`
**Type:** Accountant Procedure (Mutation)  
**Purpose:** Accept multiple invoices at once

**Input:**
```typescript
{
  ids: string[];         // Array of invoice UUIDs
  comment?: string;      // Optional comment for all
}
```

**Behavior:**
- Processes each invoice individually
- Continues on errors (doesn't stop batch)
- Returns success/failure for each

**Output:**
```typescript
{
  results: Array<{
    id: string;
    success: boolean;
    error?: string;
  }>;
}
```

---

#### `invoice.bulkReject`
**Type:** Accountant Procedure (Mutation)  
**Purpose:** Reject multiple invoices

**Input:**
```typescript
{
  ids: string[];
  rejectionReason: string;    // Same reason for all
}
```

**Similar to bulkAccept:** Processes individually, returns results array

---

#### `invoice.delete`
**Type:** Admin Procedure (Mutation)  
**Purpose:** Delete invoice (admin only)

**Input:**
```typescript
{
  id: string;
  password: string;    // Admin password confirmation
}
```

**Validation:**
- Password must be correct
- Admin only

**Side Effects:**
- Deletes invoice record
- Deletes image from MinIO
- If invoice was accepted, reverses saldo transaction
- Creates audit log entry

---

## Budget Request Router (`budgetRequest`)

#### `budgetRequest.create`
**Type:** Protected Procedure (Mutation)  
**Purpose:** Request budget increase

**Input:**
```typescript
{
  requestedAmount: number;      // Positive number
  justification: string;        // 10-2000 chars
  companyId?: string;           // Optional company link
}
```

**Validation:**
- User can only have one pending request at a time
- Amount must be positive
- Justification required

**Side Effects:**
- Creates request with "pending" status
- Records current balance at time of request
- Notifies accountants

---

#### `budgetRequest.review`
**Type:** Accountant Procedure (Mutation)  
**Purpose:** Approve or reject budget request

**Input:**
```typescript
{
  id: string;
  action: "approve" | "reject";
  rejectionReason?: string;      // Required if rejecting
}
```

**Approve Transaction:**
1. Update request status to "approved"
2. Increase user saldo by requested amount
3. Create saldo transaction
4. Set reviewedBy and reviewedAt
5. Commit or rollback

**Reject:**
- Update status to "rejected"
- Record rejection reason
- No saldo change

**Concurrency Protection:**
- Checks if request already processed
- Returns CONFLICT if changed by another accountant

**Side Effects:**
- Notification sent to user
- Audit log created

---

#### `budgetRequest.settle`
**Type:** Accountant Procedure (Mutation)  
**Purpose:** Mark approved request as settled

**Input:**
```typescript
{
  id: string;
}
```

**Validation:**
- Request must be "approved" or "money_transferred"

**Side Effects:**
- Updates status to "settled"
- Records settledBy and settledAt
- Notification sent

---

#### `budgetRequest.confirmTransfer`
**Type:** Accountant Procedure (Mutation)  
**Purpose:** Confirm money was transferred

**Input:**
```typescript
{
  id: string;
}
```

**Validation:**
- Request must be "approved"

**Side Effects:**
- Updates status to "money_transferred"
- Records transferConfirmedBy and transferConfirmedAt

---

## Company Router (`company`)

#### `company.listAll`
**Type:** Protected Procedure (Query)  
**Purpose:** Get all companies

**Output:**
```typescript
Array<{
  id: string;
  name: string;
  nip: string | null;
  address: string | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}>
```

**Authorization:**
- Users see only assigned companies (if permissions enabled)
- Accountants/admins see all companies

---

#### `company.create`
**Type:** Admin Procedure (Mutation)  
**Purpose:** Create new company

**Input:**
```typescript
{
  name: string;           // Max 255 chars
  nip?: string;           // Optional, max 20 chars
  address?: string;       // Optional, max 500 chars
}
```

**Validation:**
- Name required and unique
- NIP format validation (optional)

---

#### `company.update`
**Type:** Admin Procedure (Mutation)  
**Purpose:** Update company details

**Input:**
```typescript
{
  id: string;
  name?: string;
  nip?: string;
  address?: string;
  active?: boolean;
}
```

**Side Effects:**
- Updates company record
- Notifies users assigned to company (if significant change)

---

## Saldo Router (`saldo`)

#### `saldo.getTransactions`
**Type:** Protected Procedure (Query)  
**Purpose:** Get user's saldo transaction history

**Input:**
```typescript
{
  limit?: number;      // Default 50
  cursor?: string;     // For pagination
}
```

**Output:**
```typescript
{
  transactions: Array<{
    id: string;
    userId: string;
    amount: string;              // Numeric string with +/- sign
    balanceBefore: string;
    balanceAfter: string;
    description: string;
    referenceId: string | null;
    referenceType: string | null;  // "invoice", "budget_request", "correction"
    createdAt: Date;
  }>;
  nextCursor?: string;
}
```

**Authorization:**
- Users see only their own transactions
- Accountants/admins can specify userId to see any user

---

#### `saldo.adjustBalance`
**Type:** Admin Procedure (Mutation)  
**Purpose:** Manually adjust user balance

**Input:**
```typescript
{
  userId: string;
  amount: string;              // Can be negative
  description: string;         // Reason for adjustment
}
```

**Transaction:**
1. Update user saldo
2. Create saldo transaction record
3. Verify balance integrity

**Side Effects:**
- Notification sent to user
- Audit log created

---

## Notification Router (`notification`)

#### `notification.getAll`
**Type:** Protected Procedure (Infinite Query)  
**Purpose:** Get user notifications

**Input:**
```typescript
{
  limit?: number;
  cursor?: string;
}
```

**Output:**
```typescript
{
  notifications: Array<{
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    link: string | null;
    read: boolean;
    createdAt: Date;
  }>;
  nextCursor?: string;
  unreadCount: number;
}
```

---

#### `notification.markAsRead`
**Type:** Protected Procedure (Mutation)

**Input:**
```typescript
{
  id: string;
}
```

---

#### `notification.markAllAsRead`
**Type:** Protected Procedure (Mutation)

**Input:** None

**Side Effects:**
- Marks all user's notifications as read

---

## Admin Router (`admin`)

#### `admin.getStats`
**Type:** Admin Procedure (Query)  
**Purpose:** Get system statistics

**Output:**
```typescript
{
  totalUsers: number;
  activeUsers: number;
  totalCompanies: number;
  totalInvoices: number;
  invoicesByStatus: Record<InvoiceStatus, number>;
  totalBudgetRequests: number;
  budgetRequestsByStatus: Record<string, number>;
  storageUsed: string;           // Human readable (e.g., "1.2 GB")
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: Date;
  }>;
}
```

---

#### `admin.bulkDeleteInvoices`
**Type:** Admin Procedure (Mutation)  
**Purpose:** Delete old invoices

**Input:**
```typescript
{
  beforeDate: string;      // ISO date string
  password: string;        // Admin password confirmation
}
```

**Validation:**
- Password must match
- Date must be valid

**Side Effects:**
- Deletes invoices created before date
- Deletes associated files from MinIO
- Reverses saldo if needed
- Cannot be undone

**Output:**
```typescript
{
  deleted: number;
}
```

---

## Exports Router (`exports`)

#### `exports.generateInvoicesReport`
**Type:** Accountant Procedure (Query)  
**Purpose:** Generate invoice report data

**Input:**
```typescript
{
  dateFrom?: string;           // ISO date
  dateTo?: string;
  companyId?: string;
  status?: InvoiceStatus;
  invoiceType?: InvoiceType;
  userId?: string;
}
```

**Output:**
```typescript
{
  success: true;
  data: Array<{
    id: string;
    invoiceNumber: string;
    userName: string;
    companyName: string;
    amount: string;
    status: string;
    type: string;
    ksefNumber: string | null;
    submittedAt: string;
    reviewedAt: string | null;
    reviewerName: string | null;
  }>;
}
```

**Note:** This returns data only. Frontend handles Excel/PDF generation.

---

## Common Patterns

### Pagination with Infinite Queries

Many list endpoints use cursor-based pagination:

```typescript
const { data, fetchNextPage, hasNextPage } = trpc.invoice.getAll.useInfiniteQuery(
  { status: "pending", limit: 50 },
  {
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  }
);
```

### Optimistic Updates

tRPC React Query integration supports optimistic updates:

```typescript
const utils = trpc.useUtils();

const acceptMutation = trpc.invoice.acceptInvoice.useMutation({
  onMutate: async (variables) => {
    // Cancel outgoing refetches
    await utils.invoice.getById.cancel({ id: variables.id });
    
    // Snapshot previous value
    const previous = utils.invoice.getById.getData({ id: variables.id });
    
    // Optimistically update
    utils.invoice.getById.setData({ id: variables.id }, (old) => ({
      ...old!,
      status: "accepted",
    }));
    
    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    utils.invoice.getById.setData({ id: variables.id }, context.previous);
  },
  onSettled: () => {
    // Refetch after mutation
    utils.invoice.getById.invalidate();
  },
});
```

### Error Handling

tRPC errors have standard structure:

```typescript
try {
  await trpc.invoice.create.mutate(data);
} catch (error) {
  if (error.data?.code === "FORBIDDEN") {
    // Handle permission denied
  } else if (error.data?.code === "BAD_REQUEST") {
    // Handle validation error
  }
  // error.message has user-friendly message
}
```

### Input Validation

All inputs are validated with Zod schemas:

```typescript
z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password too short"),
})
```

Validation errors are automatically returned to client.

---

## Error Handling

### Error Codes

- **`UNAUTHORIZED`**: Not logged in or invalid credentials
- **`FORBIDDEN`**: Logged in but insufficient permissions
- **`NOT_FOUND`**: Resource doesn't exist
- **`BAD_REQUEST`**: Invalid input or business logic error
- **`CONFLICT`**: Concurrent modification detected
- **`INTERNAL_SERVER_ERROR`**: Unexpected server error
- **`TOO_MANY_REQUESTS`**: Rate limit exceeded

### Error Response Format

```typescript
{
  error: {
    message: string;        // User-friendly message
    code: string;           // Error code
    data: {
      code: string;         // Same as above
      httpStatus: number;   // HTTP status code
      path: string;         // API path
      zodError?: object;    // Zod validation errors (if applicable)
    };
  };
}
```

---

## Rate Limiting

**Implementation:** IP-based rate limiting on auth endpoints

**Limits:**
- Login attempts: 5 per minute per IP
- Password reset: 3 per hour per IP
- Account creation: 5 per hour per IP

**After Lockout:**
- 3 failed login attempts: 30-second account lockout
- Cleared on successful login

**See:** [RATE_LIMITING.md](RATE_LIMITING.md)

---

## Security Considerations

### CSRF Protection

- **Mutation endpoints**: Origin header checked against allowed origins
- **Query endpoints**: No CSRF check (GET operations are safe)
- **Cookie settings**: httpOnly, secure (in production), sameSite=lax

### Session Management

- **Session storage**: Database-backed (PostgreSQL)
- **Expiration**: 60 days from last activity
- **Refresh**: Automatic on each request
- **Invalidation**: Logout or manual admin action

### Password Security

- **Hashing**: Argon2id with 64MB memory cost, 3 iterations
- **Validation**: Minimum requirements enforced
- **Reset**: Secure token-based (if implemented)

### File Upload Security

- **Validation**: File type and size checked
- **Compression**: Images compressed before storage
- **Storage**: MinIO with private buckets
- **URLs**: Presigned URLs with 15-minute expiry

---

## Development

### Adding New Procedures

1. Define Zod input schema:
```typescript
const myInputSchema = z.object({
  field: z.string(),
});
```

2. Add procedure to router:
```typescript
export const myRouter = createTRPCRouter({
  myProcedure: protectedProcedure
    .input(myInputSchema)
    .query(async ({ ctx, input }) => {
      // Implementation
      return data;
    }),
});
```

3. Add to main router:
```typescript
export const appRouter = createTRPCRouter({
  myRouter,
  // ... other routers
});
```

4. Use in frontend:
```typescript
const { data } = trpc.myRouter.myProcedure.useQuery({ field: "value" });
```

### Testing

See [TESTING.md](TESTING.md) for API testing strategies.

---

## Additional Resources

- **tRPC Documentation**: https://trpc.io/
- **Zod Documentation**: https://zod.dev/
- **React Query**: https://tanstack.com/query/latest
- **Feature Docs**: [FEATURES.md](FEATURES.md)
- **Architecture**: [ARCHITECTURE.md](ARCHITECTURE.md)

---

**Note:** This is a living document. As the API evolves, this documentation should be updated to reflect changes.
