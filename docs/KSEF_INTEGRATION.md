# KSeF Integration Implementation

## Overview

The KSeF (Krajowy System e-Faktur) integration allows users to verify invoices against the Polish Ministry of Finance's electronic invoice system directly from the mobiFaktura application.

## Architecture

### Backend (tRPC Procedure)

The KSeF integration uses a **tRPC procedure** (`trpc.ksef.verifyInvoice`) instead of raw API routes. This ensures:

✅ **Type Safety** - Full TypeScript support for input/output validation
✅ **Authentication** - Protected by `protectedProcedure` (requires login)
✅ **Authorization** - Logs user actions and IP addresses
✅ **Rate Limiting** - Applied via global rate limiter
✅ **CSRF Protection** - Automatic CSRF token validation
✅ **Error Handling** - Proper error codes and messages
✅ **Logging** - All requests and errors are logged

### File Structure

```
src/
├── server/
│   └── trpc/
│       ├── routers/
│       │   └── ksef.ts          # KSeF tRPC router
│       └── router.ts             # Main router (includes ksef)
├── components/
│   └── ksef-invoice-popup.tsx    # Frontend popup component
├── app/
│   ├── a/
│   │   └── invoices/
│   │       └── page.tsx          # Invoices page (uses popup)
│   └── api/
│       └── ksef/
│           └── route.ts          # Deprecated - redirects to tRPC
└── types/
    └── xml2js.d.ts               # TypeScript definitions for xml2js
```

## API Documentation

### tRPC Procedure: `ksef.verifyInvoice`

**Type:** Query (read-only operation)

**Input:**
```typescript
{
  ksefNumber: string,  // KSeF invoice number (18-36 characters)
  invoiceId?: string   // Optional invoice ID to automatically match company token
}
```

**Multi-company Support:**
The system automatically selects the correct KSeF token based on the company associated with the invoice.
1. If `invoiceId` is provided, the system looks up the company's NIP.
2. It then looks for an environment variable named `KSEF_TOKEN_[NIP]` (e.g., `KSEF_TOKEN_1234567890`).
3. If not found, it falls back to the default `KSEF_TOKEN`.

**Output:**
```typescript
{
  valid: boolean
  invoice: {
    Faktura: {
      Fa: {
        NrFa: string              // Invoice number
      }
      Podmiot1: {
        DaneIdentyfikacyjne: {
          Nazwa: string            // Seller name
        }
      }
      Podmiot2: {
        DaneIdentyfikacyjne: {
          Nazwa: string            // Buyer name
        }
      }
      FaPodsumowanie: {
        KwotaBrutto: string        // Total amount
        DataWystawienia: string    // Invoice date
      }
    }
  }
  ksefNumber: string  // Original KSeF number
}
```

**Error Responses:**
- `NOT_FOUND` (404) - Invoice not found in KSeF system
- `FORBIDDEN` (403) - No access to invoice in KSeF system
- `UNAUTHORIZED` (401) - User not authenticated
- `INTERNAL_SERVER_ERROR` (500) - Server error
- `TOO_MANY_REQUESTS` (429) - Rate limit exceeded

### Frontend Component: `KsefInvoicePopup`

```typescript
<KsefInvoicePopup
  ksefNumber="string"                    // KSeF number to verify
  invoiceId="string"                     // Optional invoice ID for multi-company token matching
  open={boolean}                         // Dialog open state
  onOpenChange={(open: boolean) => {}}   // Dialog state handler
/>
```

**Features:**
- Automatic verification when dialog opens
- Loading state with spinner
- Success state with invoice details
- Error state with error message
- Responsive design (mobile & desktop)

## Usage Example

### Frontend

```typescript
import { useState } from "react";
import { KsefInvoicePopup } from "@/components/ksef-invoice-popup";

export function MyComponent() {
  const [ksefPopupOpen, setKsefPopupOpen] = useState(false);
  const [ksefNumber, setKsefNumber] = useState<string | null>(null);

  return (
    <>
      <button
        onClick={() => {
          setKsefNumber("SOME_KSEF_NUMBER");
          setKsefPopupOpen(true);
        }}
      >
        Verify Invoice
      </button>

      <KsefInvoicePopup
        ksefNumber={ksefNumber || ""}
        open={ksefPopupOpen}
        onOpenChange={setKsefPopupOpen}
      />
    </>
  );
}
```

### Direct tRPC Usage

```typescript
import { trpc } from "@/lib/trpc/client";

export function MyComponent() {
  const { data, isLoading, error } = trpc.ksef.verifyInvoice.useQuery(
    { ksefNumber: "YOUR_KSEF_NUMBER" }
  );

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (data?.valid) {
    return <div>Invoice verified: {data.invoice.Faktura.Fa.NrFa}</div>;
  }
}
```

## Security Features

### 1. Authentication
- All KSeF operations require authentication via `protectedProcedure`
- Unauthenticated requests receive `UNAUTHORIZED` response

### 2. Authorization
- User ID is logged with every request
- IP address is tracked for security monitoring
- Failed verification attempts are logged with warning level

### 3. Input Validation
- KSeF numbers validated against regex: `^[A-Z0-9\-]+$`
- Length validation: 18-36 characters
- Invalid inputs rejected before KSeF API call

### 4. Rate Limiting
- Global rate limiter applied to all authenticated users
- Prevents brute force attacks
- Configurable per user and IP

### 5. CSRF Protection
- Automatic CSRF token validation for mutations
- Origin header validation
- Protects against cross-site request forgery

### 6. Timeout Protection
- All external KSeF API calls have 10-second timeout
- Prevents hanging requests
- Graceful error handling on timeout

### 7. Sensitive Data Redaction
- Passwords and tokens automatically redacted from logs
- KSeF tokens not exposed in error messages
- XML data safely parsed with configurable options

### 8. Error Handling
- Specific error codes for different failure scenarios
- Generic error messages to frontend (no sensitive details)
- Full error details logged server-side

## Configuration

### Environment Variables

```bash
# Required
KSEF_TOKEN=your_ksef_api_token_here

# Optional (inherits defaults)
LOG_LEVEL=info
```

### Rate Limiting

Global rate limit (default: 100 requests per minute per user)

To modify, edit `src/server/lib/rate-limit.ts`

## Monitoring & Logging

All KSeF operations are logged:

```typescript
// Start of verification
apiLogger.info({
  type: "ksef_verification_start",
  userId: ctx.user.id,
  ksefNumber: input.ksefNumber,
});

// Success
apiLogger.info({
  type: "ksef_verification_success",
  userId: ctx.user.id,
  ksefNumber: input.ksefNumber,
  duration: "123ms",
});

// Failure
apiLogger.warn({
  type: "ksef_verification_failed",
  userId: ctx.user.id,
  ksefNumber: input.ksefNumber,
  error: "Invoice not found",
  duration: "456ms",
});
```

## Deprecation Notice

The old API route (`/api/ksef`) is now **deprecated** and returns:
- Status: 410 (Gone)
- Message: Redirect users to use tRPC instead

This ensures all KSeF requests go through the secure, type-safe tRPC layer.

## Migration from Old API

If you were using the old API endpoint:

**Before:**
```typescript
const res = await fetch(`/api/ksef?ksefNumber=${number}`);
const data = await res.json();
```

**After (recommended):**
```typescript
const { data } = trpc.ksef.verifyInvoice.useQuery({ ksefNumber: number });
```

Or use the popup component:
```typescript
<KsefInvoicePopup
  ksefNumber={number}
  open={isOpen}
  onOpenChange={setIsOpen}
/>
```

## Troubleshooting

### "KSeF token not configured"
- Ensure `KSEF_TOKEN` environment variable is set
- Check `.env.local` file

### "Failed to authenticate with KSeF system"
- Verify KSeF token is valid
- Check KSeF service status
- Review server logs for details

### "Invoice not found in KSeF system"
- Verify KSeF number is correct
- Ensure invoice exists in KSeF
- Check user has access to invoice

### "Rate limit exceeded"
- Too many requests in short time
- Wait a minute and retry
- Check rate limit configuration

### TypeScript errors with xml2js
- Ensure `src/types/xml2js.d.ts` exists
- Run `npm install`
- Restart TypeScript server

## Testing

### Test KSeF Integration

```typescript
// Use this to test with a valid KSeF number
const { data } = await trpc.ksef.verifyInvoice.query({
  ksefNumber: "VALID_KSEF_NUMBER_HERE"
});

console.log(data.invoice);
```

### Mock Testing

```typescript
// In your test setup
jest.mock("@/server/trpc/routers/ksef", () => ({
  ksefRouter: {
    verifyInvoice: {
      query: async () => ({
        valid: true,
        invoice: { /* mock data */ }
      })
    }
  }
}));
```

## Future Enhancements

- [ ] Cache verified invoices (with TTL)
- [ ] Batch verification endpoint
- [ ] Webhook notifications for failed verifications
- [ ] Download invoice PDF from KSeF
- [ ] Invoice status tracking
- [ ] Integration with invoice workflow

## References

- [KSeF Official API Documentation](https://www.gov.pl/web/kas/ksef)
- [tRPC Documentation](https://trpc.io/)
- [mobiFaktura Architecture](./ARCHITECTURE.md)
- [Security Standards](./AUTH_SECURITY_AUDIT.md)
