# mobiFaktura - Advanced Features Guide

## 🆕 Recent Enhancements

This document describes the advanced features added to mobiFaktura.

## Multi-Accountant Workflow

### Problem Solved
Multiple accountants working simultaneously can now see who's reviewing what, preventing duplicate work and conflicts.

### How It Works
1. Invoice starts with `status: pending`
2. Accountant clicks invoice → calls `startReview()`
3. Status changes to `in_review`, `currentReviewer` set
4. Other accountants see "👁️ [Name]" indicator
5. If another accountant tries to review, they get: *"Ta faktura jest obecnie przeglądana przez [Name]"*
6. After accept/reject, `status` updates and `currentReviewer` clears

### Database Fields
```typescript
status: 'pending' | 'in_review' | 'accepted' | 'rejected'
currentReviewer: uuid // Who's currently viewing
reviewStartedAt: timestamp // When review began
reviewedBy: uuid // Final decision maker
reviewedAt: timestamp // When decision was made
```

## Automatic OCR (Optical Character Recognition)

### Tesseract Integration
- **Image**: `tesseractshadow/tesseract4re:latest`
- **Port**: 7884
- **Languages**: Polish + English
- **Processing**: Asynchronous (doesn't block upload)

### OCR Flow
```mermaid
User uploads image
↓
Image compressed (80% JPEG)
↓
Uploaded to MinIO
↓
Invoice created in DB (ocrProcessed: false)
↓
OCR starts in background
↓
Text extracted and parsed
↓
Invoice updated with structured data
↓
Accountant sees pre-filled form
```

### Extracted Fields
- **Invoice Number**: Patterns like `FV/2024/001`, `Faktura nr: 123`
- **Invoice Date**: `DD.MM.YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`
- **Supplier Name**: Text after "Sprzedawca:", "Seller:", etc.
- **Supplier NIP**: Polish tax ID (10 digits)
- **Total Amount**: Currency patterns (`1234.56 PLN`)
- **Products**: Line items with amounts

### OCR Confidence
- Displayed as percentage (e.g., "85% pewności")
- Helps accountant know when to double-check
- Shown with ⚠️ icon if low confidence

## Image Compression & Storage

### Before: Base64 in Database ❌
```javascript
// OLD WAY (REMOVED)
const base64 = await convertToBase64(image);
await db.insert({ imageData: base64 }); // 1 MB → 1.4 MB in DB
```

### After: Compressed in MinIO ✅
```javascript
// NEW WAY
const compressed = await sharp(buffer)
  .resize(2000, null, { fit: 'inside' })
  .jpeg({ quality: 80 })
  .toBuffer();
  
await uploadFile(compressed, objectKey, 'image/jpeg'); // ~400 KB in S3
await db.insert({ imageKey: objectKey }); // Just 50 bytes
```

### Storage Savings
| Invoices | Base64 (DB) | MinIO (S3) | Savings |
|----------|-------------|------------|---------|
| 10       | 14 MB       | 4 MB       | 71%     |
| 100      | 140 MB      | 40 MB      | 71%     |
| 1000     | 1.4 GB      | 400 MB     | 71%     |

### Sharp Configuration
```typescript
{
  resize: {
    width: 2000,
    fit: 'inside',
    withoutEnlargement: true
  },
  jpeg: {
    quality: 80,
    progressive: true,
    mozjpeg: true
  }
}
```

## Separate Review Page

### Route
```
/auth/invoice/[id]
```

### Layout
```
┌─────────────────────────────────────┐
│         UserHeader                  │
├──────────────────┬──────────────────┤
│                  │                  │
│   Invoice Image  │   Editable Form  │
│   (clickable)    │   - Nr faktury   │
│                  │   - Data         │
│   [Zoom Icon]    │   - Dostawca     │
│                  │   - NIP          │
│                  │   - Kwota        │
│                  │   - Opis         │
│                  │                  │
│                  │   [Save Button]  │
│                  │                  │
├──────────────────┴──────────────────┤
│  [Odrzuć]        [Zaakceptuj]       │
└─────────────────────────────────────┘
```

### Features
1. **Real-time Locking**: First accountant to open gets exclusive edit
2. **Inline Save**: Update any field, click "Zapisz zmiany"
3. **Image Zoom**: Click image → full-screen modal
4. **OCR Indicator**: Shows confidence and processing status
5. **Status Badge**: Color-coded (yellow/blue/green/red)

### Action Flow
```typescript
// Open page
GET /auth/invoice/[id] → loads data

// Start reviewing
POST startReview({ id }) → sets currentReviewer

// Edit data
POST updateInvoiceData({ id, ...fields }) → saves changes

// Finalize
POST finalizeReview({ id, status }) → accept/reject
```

## Image Zoom Modal

### Implementation
```tsx
<Dialog open={imageZoomed} onOpenChange={setImageZoomed}>
  <DialogContent className="max-w-6xl">
    <img src={invoice.imageUrl} alt="Powiększenie" />
  </DialogContent>
</Dialog>
```

### User Actions
1. Click image thumbnail → modal opens
2. Scroll/pinch to zoom
3. Click outside or ESC → modal closes

### Presigned URLs
- Generated on-demand from MinIO
- Valid for 1 hour
- Secure access without exposing credentials

```typescript
const imageUrl = await getPresignedUrl(invoice.imageKey);
// https://localhost:9000/invoices/user-id/timestamp.jpg?...signature
```

## Accountant Panel Updates

### Visual Indicators
```tsx
// Pending invoice with current reviewer
┌─────────────────────────┐
│ FV/2024/001            │ 🔵 W trakcie
│ Jan Kowalski           │
│ 1234.56 PLN            │
│ 27.11.2025 10:30       │
│ 👁️ Anna Nowak          │ ← Current reviewer
└─────────────────────────┘

// Pending invoice waiting
┌─────────────────────────┐
│ Przetwarzanie OCR...   │ 🟡 Oczekuje
│ Jan Kowalski           │
│ 27.11.2025 10:25       │
│ ⚠️ OCR w trakcie        │ ← Processing
└─────────────────────────┘
```

### List Features
- **Click to navigate**: Direct link to review page
- **Status colors**: Visual differentiation
- **Amount preview**: Quick cost overview
- **Reviewer name**: Prevent conflicts
- **OCR status**: Know when data is ready

## Environment Configuration

### Development (.env)
```env
# OCR Service
TESSERACT_URL=http://localhost:7884

# Storage
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
```

### Production (.env.production)
```env
# OCR Service
TESSERACT_URL=http://tesseract:8884

# Storage
MINIO_ENDPOINT=s3.yourdomain.com
MINIO_PORT=443
MINIO_USE_SSL=true
```

## Docker Services

### Tesseract OCR
```yaml
tesseract:
  image: tesseractshadow/tesseract4re:latest
  ports:
    - "7884:8884"
  environment:
    - TESSDATA_PREFIX=/usr/share/tesseract-ocr/4.00/tessdata
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8884/health"]
```

### Resource Usage
- **CPU**: ~200m (0.2 cores during OCR)
- **Memory**: ~512 MB
- **Disk**: ~1 GB (language data)

## API Reference

### New Endpoints

#### `invoice.startReview`
```typescript
input: { id: string }
output: { success: boolean }
errors: {
  NOT_FOUND: "Invoice not found"
  CONFLICT: "Currently being reviewed by [Name]"
  BAD_REQUEST: "Already reviewed"
}
```

#### `invoice.updateInvoiceData`
```typescript
input: {
  id: string
  invoiceNumber?: string
  invoiceDate?: Date
  supplierName?: string
  supplierNip?: string
  totalAmount?: string
  currency?: string
  products?: string
  description?: string
}
output: { success: boolean }
errors: {
  NOT_FOUND: "Invoice not found"
  FORBIDDEN: "Not assigned to you"
}
```

#### `invoice.finalizeReview`
```typescript
input: {
  id: string
  status: 'accepted' | 'rejected'
}
output: {
  success: boolean
  invoice: Invoice
}
errors: {
  NOT_FOUND: "Invoice not found"
  FORBIDDEN: "Not assigned to you"
}
```

## Testing

### Upload Flow
```bash
# 1. Login as user
curl -X POST http://localhost:3000/api/trpc/auth.login \
  -d '{"email":"user@test.pl","password":"TestUser123!"}'

# 2. Upload invoice (sends image as data URL)
# Image is compressed → uploaded to MinIO → OCR starts

# 3. Check status
curl http://localhost:3000/api/trpc/invoice.myInvoices
# ocrProcessed: false initially, then true after ~5 seconds
```

### Review Flow
```bash
# 1. Login as accountant
# 2. Get pending invoices
curl http://localhost:3000/api/trpc/invoice.pendingInvoices

# 3. Start review
curl -X POST http://localhost:3000/api/trpc/invoice.startReview \
  -d '{"id":"invoice-uuid"}'

# 4. Update data
curl -X POST http://localhost:3000/api/trpc/invoice.updateInvoiceData \
  -d '{"id":"invoice-uuid","totalAmount":"1234.56"}'

# 5. Accept
curl -X POST http://localhost:3000/api/trpc/invoice.finalizeReview \
  -d '{"id":"invoice-uuid","status":"accepted"}'
```

## Troubleshooting

### OCR Not Working
```bash
# Check Tesseract health
curl http://localhost:7884/health

# Check logs
docker logs mobifaktura_tesseract_dev

# Restart service
docker restart mobifaktura_tesseract_dev
```

### Image Not Loading
```bash
# Check MinIO health
curl http://localhost:9000/minio/health/live

# Check bucket exists
docker exec mobifaktura_minio_dev mc ls myminio/

# Verify permissions
docker logs mobifaktura_minio_dev
```

### Review Conflicts
```sql
-- Find locked invoices
SELECT id, invoice_number, current_reviewer, review_started_at
FROM invoices
WHERE status = 'in_review';

-- Clear stuck reviews (older than 1 hour)
UPDATE invoices
SET status = 'pending', current_reviewer = NULL
WHERE status = 'in_review' 
  AND review_started_at < NOW() - INTERVAL '1 hour';
```

## Performance Tips

1. **OCR Optimization**: Process during off-peak hours if batching
2. **Image Compression**: Adjust quality based on needs (60-90%)
3. **Caching**: Use React Query cache for invoice lists
4. **Pagination**: Add if invoice count exceeds 100
5. **CDN**: Serve images from CDN in production

## Security Considerations

1. **Presigned URLs**: Auto-expire after 1 hour
2. **Access Control**: Only invoice owner and accountants can view
3. **Review Locking**: Prevents unauthorized edits
4. **Image Validation**: Only JPEG/PNG, max 10 MB
5. **OCR Sandboxing**: Tesseract runs in isolated container
