# KSeF Integration - Quick Start Guide

## 🚀 Setup (5 minutes)

### 1. Add KSeF Tokens to .env

```bash
# Default token (required)
KSEF_TOKEN=your_default_ksef_token_here

# Company-specific tokens (optional, per NIP)
KSEF_TOKEN_1234567890=token_for_company_1
KSEF_TOKEN_9876543210=token_for_company_2
```

**Format:** `KSEF_TOKEN_[NIP]` where NIP is digits only (no dashes)

### 2. That's It! 
No database migrations needed. System is ready to use.

## 📱 User Guide

### Scan QR Code & Auto-Fill
1. Upload page → Select company
2. Click QR icon next to "Nr KSEF"
3. Scan invoice QR code
4. ✨ Form auto-fills!

### Manual Fetch
1. Enter KSeF number
2. Select company
3. Click "Pobierz dane"

### Verify Invoice
1. Invoices page → Click "KSeF" button
2. See comparison:
   - ✅ Green = Data matches
   - ⚠️ Amber = Check discrepancies

## 🔧 Key Features

| Feature | Description |
|---------|-------------|
| **QR Scanning** | Instant data extraction from QR codes |
| **Auto-Fill** | Invoice number, kwota auto-populated |
| **Verification** | Real-time check against KSeF system |
| **Comparison** | Visual indicators for data mismatches |
| **Multi-Company** | Automatic token selection per company |

## 📊 Workflow

```
User scans QR
    ↓
System extracts KSeF number
    ↓
Fetches data from KSeF API
    ↓
Auto-fills form
    ↓
User submits invoice
    ↓
Accountant verifies via KSeF button
    ↓
Compares KSeF data vs entered data
    ↓
Approves/Rejects
```

## 🐛 Common Issues

| Problem | Solution |
|---------|----------|
| "Token not configured" | Add `KSEF_TOKEN` to .env |
| QR scanner not opening | Grant camera permissions |
| "Invoice not found" | Check KSeF number or wait for sync |
| No auto-fill | Select company first |

## 📚 Documentation

- **Full Guide:** `docs/KSEF_COMPLETE_INTEGRATION.md`
- **API Details:** `docs/KSEF_INTEGRATION.md`
- **Quick Ref:** `docs/KSEF_QUICKREF.md`

## ✅ What's Included

✅ QR code parser  
✅ KSeF API client  
✅ Auto-fill functionality  
✅ Verification popup with comparison  
✅ Multi-company token support  
✅ Error handling & logging  
✅ Mobile responsive  
✅ Production ready  

## 🎯 Next Steps

1. Add your KSeF tokens to `.env`
2. Test with QR code scanning
3. Verify invoice comparison works
4. Deploy to production!

---

**Status:** ✅ Production Ready  
**Last Updated:** January 24, 2026
