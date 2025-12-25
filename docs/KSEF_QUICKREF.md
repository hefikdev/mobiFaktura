# KSeF Integration - Quick Reference

## ✅ What Was Implemented

### Backend
- **tRPC Router**: `src/server/trpc/routers/ksef.ts`
  - Secure, type-safe procedure
  - Integrated with authentication, rate limiting, CSRF protection
  - Comprehensive error handling and logging

### Frontend
- **Popup Component**: `src/components/ksef-invoice-popup.tsx`
  - Uses tRPC for data fetching
  - Responsive design (mobile & desktop)
  - Loading, success, and error states
  - Beautiful UI with icons and colors

### Integration Points
- **Invoices Page**: `src/app/a/invoices/page.tsx`
  - KSeF buttons now open popup instead of external link
  - Both mobile and desktop views supported
  - Seamless user experience

### Infrastructure
- **Type Definitions**: `src/types/xml2js.d.ts`
- **Deprecation Handler**: `src/app/api/ksef/route.ts`
- **Documentation**: `docs/KSEF_INTEGRATION.md`
- **Multi-company Support**: Automatic token selection via `.env` mapping

---

## 🏢 Multi-company Configuration

To support multiple companies, add their KSeF tokens to the `.env` file using their NIP (digits only):

```env
# Default token
KSEF_TOKEN=your_default_token

# Company-specific tokens (NIP without dashes)
KSEF_TOKEN_1234567890=token_for_company_1
KSEF_TOKEN_9876543210=token_for_company_2
```

The system will automatically use the correct token when verifying an invoice.

---

## 🔒 Security Compliance

### Implemented Security Standards

| Feature | Status | Details |
|---------|--------|---------|
| **Authentication** | ✅ | Protected with `protectedProcedure` |
| **Authorization** | ✅ | Role-based access control |
| **CSRF Protection** | ✅ | Automatic origin validation |
| **Rate Limiting** | ✅ | Global rate limiter applied |
| **Input Validation** | ✅ | Zod schema validation |
| **Error Handling** | ✅ | Specific error codes, no info leaks |
| **Logging** | ✅ | User ID, IP, duration tracked |
| **Timeouts** | ✅ | 10-second timeout on external calls |
| **Data Redaction** | ✅ | Sensitive data removed from logs |
| **Type Safety** | ✅ | Full TypeScript coverage |

---

## 📋 tRPC Integration Checklist

- [x] Procedure uses `protectedProcedure` (requires auth)
- [x] Input validated with Zod schema
- [x] Proper error codes returned (NOT_FOUND, FORBIDDEN, etc.)
- [x] Integrated with rate limiting middleware
- [x] CSRF protection via middleware
- [x] Logging with tRPC logger
- [x] IP address and user ID tracking
- [x] Timeout protection on external calls
- [x] Added to main router (`src/server/trpc/router.ts`)
- [x] Frontend uses tRPC client (`trpc.ksef.verifyInvoice`)

---

## 🚀 Usage Instructions

### For Users
1. Go to Invoices page
2. Find invoice with KSeF number
3. Click "KSeF" button
4. Wait for verification
5. See invoice details in popup

### For Developers

#### Use the Popup Component
```typescript
import { KsefInvoicePopup } from "@/components/ksef-invoice-popup";
import { useState } from "react";

export function MyPage() {
  const [open, setOpen] = useState(false);
  const [ksefNumber, setKsefNumber] = useState("");

  return (
    <>
      <button onClick={() => {
        setKsefNumber("YOUR_KSEF_NUMBER");
        setOpen(true);
      }}>
        Verify
      </button>
      <KsefInvoicePopup
        ksefNumber={ksefNumber}
        invoiceId={invoiceId} // Optional: for multi-company token matching
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
```

#### Use tRPC Directly
```typescript
import { trpc } from "@/lib/trpc/client";

const { data, isLoading, error } = trpc.ksef.verifyInvoice.useQuery({
  ksefNumber: "KSEF_NUMBER"
});
```

---

## 🔧 Configuration

### Environment Variable
```bash
# Required in .env.local
KSEF_TOKEN=your_token_here
```

### KSeF Number Format
- Length: 18-36 characters
- Pattern: `^[A-Z0-9\-]+$`
- Example: `XXXXXXXXXXXXXXXX-XXXXX`

---

## 📊 Logging & Monitoring

### Successful Verification
```json
{
  "type": "ksef_verification_success",
  "userId": "user123",
  "ksefNumber": "ABC123...",
  "duration": "234ms"
}
```

### Failed Verification
```json
{
  "type": "ksef_verification_failed",
  "userId": "user123",
  "ksefNumber": "ABC123...",
  "error": "Invoice not found",
  "duration": "189ms"
}
```

---

## ⚠️ Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "KSeF token not configured" | Missing env var | Add `KSEF_TOKEN` to `.env.local` |
| "Failed to authenticate" | Invalid token | Verify KSeF token is correct |
| "Invoice not found" | Wrong KSeF number | Check invoice exists in KSeF |
| "Rate limit exceeded" | Too many requests | Wait a minute, retry |
| TypeScript errors | Missing types | Check `src/types/xml2js.d.ts` exists |
| Popup doesn't open | Component error | Check browser console for errors |

---

## 🧪 Testing

### Manual Testing
1. Find invoice with KSeF number
2. Click KSeF button
3. Verify popup opens and loads
4. Check success/error message

### Integration Testing
```typescript
const result = await trpc.ksef.verifyInvoice.query({
  ksefNumber: "VALID_KSEF_NUMBER"
});

expect(result.valid).toBe(true);
expect(result.invoice).toBeDefined();
```

---

## 📚 Files Modified/Created

### New Files
- `src/server/trpc/routers/ksef.ts` - KSeF tRPC router
- `src/components/ksef-invoice-popup.tsx` - Popup component
- `src/types/xml2js.d.ts` - TypeScript definitions
- `docs/KSEF_INTEGRATION.md` - Full documentation
- `docs/KSEF_QUICKREF.md` - This file

### Modified Files
- `src/server/trpc/router.ts` - Added ksef router
- `src/app/a/invoices/page.tsx` - Integrated popup
- `src/app/api/ksef/route.ts` - Deprecated endpoint

---

## 🔍 Compliance Verification

### Security Audit ✅
- [x] No hardcoded secrets
- [x] All user inputs validated
- [x] Rate limiting active
- [x] CSRF protection enabled
- [x] Proper error messages
- [x] Logging is comprehensive
- [x] Timeouts configured
- [x] No information leakage

### tRPC Standards ✅
- [x] Uses proper middleware
- [x] Type-safe input/output
- [x] Error handling with codes
- [x] Integrated with auth system
- [x] Follows existing patterns
- [x] Proper procedure type (query)

### Performance ✅
- [x] Reasonable timeouts (10s)
- [x] No unnecessary retries
- [x] Efficient XML parsing
- [x] Rate limiting prevents abuse

---

## 🎯 Next Steps

1. **Set KSeF Token**
   ```bash
   # Add to .env.local
   KSEF_TOKEN=your_token_here
   ```

2. **Test Integration**
   - Navigate to Invoices page
   - Find invoice with KSeF number
   - Click KSeF button
   - Verify it works

3. **Monitor Logs**
   - Check `logs/` directory for errors
   - Monitor user interactions
   - Track verification success rate

4. **Optional Enhancements**
   - Add caching layer
   - Implement batch verification
   - Store verification results
   - Send notifications

---

## 📞 Support

For issues or questions:
1. Check `docs/KSEF_INTEGRATION.md` for detailed docs
2. Review server logs in `logs/` directory
3. Check browser console for client-side errors
4. Verify `KSEF_TOKEN` is configured correctly
