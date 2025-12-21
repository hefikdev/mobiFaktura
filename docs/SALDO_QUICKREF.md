# Saldo System - Quick Reference

## What is Saldo?

Saldo is a budget management system that tracks user spending on invoices. Each user has a balance that decreases when they submit invoices.

## Key Concepts

- **Saldo** = User's current budget balance (can be negative)
- **Kwota** = Invoice amount
- **Transaction** = Any change to saldo (adjustment or deduction)

## Quick Links

| Role | Page | URL | Purpose |
|------|------|-----|---------|
| Admin/Accountant | Saldo Management | `/a/saldo` | Manage user budgets |
| All Users | Transaction History | `/a/saldo-history` | View balance changes |
| User | Dashboard | `/a/dashboard` | See current saldo |

## Common Tasks

### Assign Budget to User (Admin/Accountant)
1. Go to `/a/saldo`
2. Click "Dostosuj" next to user
3. Enter amount (e.g., `5000`)
4. Add note
5. Save

### Reduce User Budget (Admin/Accountant)
1. Go to `/a/saldo`
2. Click "Dostosuj" next to user
3. Enter **negative** amount (e.g., `-500`)
4. Add note explaining reduction
5. Save

### Check Your Balance (User)
- Look at header (top right) - shows current saldo
- Click badge to see full history
- Or visit `/a/saldo-history`

### Submit Invoice (User)
1. Upload invoice as normal
2. Enter kwota (amount)
3. System automatically reduces your saldo

## Balance Colors

| Color | Meaning |
|-------|---------|
| 🟢 Green | Positive balance - budget available |
| 🔴 Red | Negative balance - over budget |
| ⚫ Gray | Zero balance - budget exhausted |

## tRPC Endpoints

### For Users
```typescript
api.saldo.getMySaldo.useQuery()
api.saldo.getSaldoHistory.useQuery({ limit: 50, offset: 0 })
```

### For Admin/Accountant
```typescript
api.saldo.getAllUsersSaldo.useQuery()
api.saldo.adjustSaldo.useMutation({ userId, amount, notes })
api.saldo.getSaldoStats.useQuery()
```

## Example Scenarios

### Scenario 1: New User Setup
```
Initial saldo: 0 PLN
Admin assigns: +10000 PLN
New saldo: 10000 PLN
```

### Scenario 2: User Submits Invoice
```
Current saldo: 10000 PLN
Invoice kwota: 350.50 PLN
New saldo: 9649.50 PLN
```

### Scenario 3: User Exceeds Budget
```
Current saldo: 100 PLN
Invoice kwota: 500 PLN
New saldo: -400 PLN (allowed!)
```

### Scenario 4: Budget Correction
```
Current saldo: 5000 PLN
Admin adjustment: -1000 PLN (correction)
New saldo: 4000 PLN
```

## Transaction Types

| Type | When | Amount |
|------|------|--------|
| `adjustment` | Admin changes balance | + or - |
| `invoice_deduction` | User submits invoice | - (negative) |
| `invoice_refund` | Invoice rejected* | + (positive) |

*Invoice refund feature not yet implemented

## Permissions

| Action | User | Accountant | Admin |
|--------|------|------------|-------|
| View own saldo | ✅ | ✅ | ✅ |
| View own history | ✅ | ✅ | ✅ |
| View all users' saldo | ❌ | ✅ | ✅ |
| Adjust any saldo | ❌ | ✅ | ✅ |
| View statistics | ❌ | ✅ | ✅ |

## Database Tables

### users
- Added: `saldo` column (numeric, default 0)

### saldo_transactions (new)
- `id` - Transaction ID
- `user_id` - User reference
- `amount` - Change amount
- `balance_before` - Saldo before change
- `balance_after` - Saldo after change
- `transaction_type` - Type of transaction
- `reference_id` - Invoice ID (if applicable)
- `notes` - Description
- `created_by` - Who made the change
- `created_at` - When it happened

## Troubleshooting

### User's saldo not updating
- Check if kwota was provided in invoice
- Verify invoice was created successfully
- Check transaction history for deduction record

### Cannot adjust saldo
- Verify you are admin or accountant
- Check note is at least 5 characters
- Ensure amount is not zero

### Transaction history is empty
- User may not have any transactions yet
- Check if looking at correct user
- Verify filters/pagination

## Tips

1. **Regular Reviews**: Check `/a/saldo` weekly to monitor budgets
2. **Clear Notes**: Always add descriptive notes for adjustments
3. **Negative Balances**: Use to identify users needing budget increase
4. **Search Feature**: Use search bar to quickly find users
5. **Statistics**: Use stats cards to get overview of all budgets

## Migration

Run once after pulling code:
```bash
npm run db:push
```

This adds the saldo system to your database.

## Files Changed

### Backend
- `src/server/db/schema.ts` - Added tables
- `src/server/trpc/routers/saldo.ts` - New router
- `src/server/trpc/routers/invoice.ts` - Auto-deduction
- `src/server/trpc/router.ts` - Register router

### Frontend  
- `src/app/a/saldo/page.tsx` - Management page
- `src/app/a/saldo-history/page.tsx` - History page
- `src/app/a/dashboard/page.tsx` - Show saldo
- `src/components/saldo-display.tsx` - Display component
- `src/components/*-header.tsx` - Updated all headers

### Database
- `drizzle/0014_add_saldo_system.sql` - Migration

## Support

See full documentation: `/docs/SALDO_SYSTEM.md`
