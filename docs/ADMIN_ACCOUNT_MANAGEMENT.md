# Admin Account Management System

## Overview

This document describes the multi-layered admin account safety system implemented in mobiFaktura to prevent lockout scenarios and ensure administrative access under all circumstances.

## Problem Scenarios Addressed

1. **No admins exist** - Fresh install or all admins deleted
2. **Admin forgot password** - Cannot reset without another admin
3. **Only one admin exists** - Single point of failure
4. **Login system broken** - Database issues or code bugs
5. **Emergency data access needed** - Critical business continuity

## Implemented Solutions

### 🔒 Layer 1: Environment-Based Super Admin (PRIMARY)

**Most Reliable - Always Works**

Set up emergency super admin credentials in your `.env` file:

```bash
# Emergency super admin credentials
SUPER_ADMIN_EMAIL=emergency@yourdomain.com
SUPER_ADMIN_PASSWORD=YourSecurePassword123!
```

**How to Use:**
1. Set up super admin credentials in `.env` file
2. Use CLI emergency admin tool: `npm run create-emergency-admin`
3. Or login via regular login at `/login` with super admin credentials
4. System will authenticate if credentials match `.env` values

**Note:** Emergency super admin works silently through the regular login flow - no special UI required for security reasons.

**Features:**
- ✅ Works even if database is corrupted
- ✅ Creates account if it doesn't exist
- ✅ Updates password if account exists
- ✅ Forces admin role on the account
- ✅ No database queries needed beforehand

**When to Use:**
- All admin accounts are locked out
- Forgot all admin passwords
- Database corruption affecting admin accounts
- Emergency access needed immediately

**Note:** Admin login is now unified with the main login page at `/login`. All users (regular, accountant, admin) use the same login page.

---

### 🛡️ Layer 2: Zero-Admin Auto-Promotion (CONVENIENCE)

**Automatic Safety Net for Fresh Installs**

When registering a new account:
- System checks if any admin accounts exist
- If **zero admins** found, the new user becomes admin automatically
- If admins exist, normal role assignment applies

**How it Works:**
```typescript
// During registration
const adminCount = await getAdminCount();
const finalRole = adminCount === 0 ? "admin" : requestedRole;
```

**Benefits:**
- ✅ Prevents "no admin" scenarios on fresh installs
- ✅ Automatic first-admin creation
- ✅ No manual intervention needed
- ✅ Works for initial setup

**When it Activates:**
- First user registration after database setup
- After all admins are deleted (via database)
- Clean slate scenarios

---

### 🔧 Layer 3: CLI Emergency Admin Tool (BACKUP)

**Database-Level Recovery**

Use this command-line tool when you have direct database access but cannot login:

**Basic Usage:**
```bash
npm run create-emergency-admin
```

**Interactive Mode:**
```bash
$ npm run create-emergency-admin
🚨 Emergency Admin Creation Tool

Enter admin email: recovery@admin.com
Enter admin password (min 8 chars): SecurePass123!

✅ Emergency admin created successfully!
```

**Environment Variable Mode:**
```bash
ADMIN_EMAIL=recovery@admin.com ADMIN_PASSWORD=SecurePass123! npm run create-emergency-admin
```

**Features:**
- ✅ Creates new admin or updates existing user to admin
- ✅ Works with direct database access
- ✅ Bypasses all application logic
- ✅ Interactive or automated via environment variables
- ✅ Resets password for existing accounts

**When to Use:**
- Login system is completely broken
- Need command-line recovery
- Automated deployment/recovery scripts
- Server-side only access

---

### 🔐 Layer 4: Admin Password Reset (EXISTING)

**Admin-to-Admin Support**

Admins can reset passwords for any user including other admins:

**Location:** `/a/admin` → User Management → Reset Password

**Features:**
- ✅ Admin can reset any user's password
- ✅ Works for all roles (user, accountant, admin)
- ✅ Requires current admin session
- ✅ Generates secure new password

**When to Use:**
- Admin forgot their password but another admin is available
- User account recovery
- Password reset for any role

---

## Security Considerations

### Environment-Based Super Admin
- ⚠️ **CRITICAL:** Store `.env` file securely
- ⚠️ Never commit `.env` to version control
- ⚠️ Use strong, unique password
- ⚠️ Rotate credentials periodically
- ⚠️ Limit access to production `.env` files

### CLI Emergency Tool
- ⚠️ Requires direct server/database access
- ⚠️ Should be run only by authorized personnel
- ⚠️ Log all emergency admin creations
- ⚠️ Audit emergency access regularly

### Zero-Admin Auto-Promotion
- ✅ Safe - only activates when NO admins exist
- ✅ Cannot be exploited if admins already exist
- ✅ Race condition protected

---

## Recommended Setup

### For Production

1. **Set up Super Admin in `.env`:**
   ```bash
   SUPER_ADMIN_EMAIL=emergency@yourcompany.com
   SUPER_ADMIN_PASSWORD=<generate-strong-password>
   ```

2. **Document emergency procedures:**
   - Store super admin credentials in password manager
   - Share with at least 2 authorized personnel
   - Include in disaster recovery documentation

3. **Maintain multiple admins:**
   - Always have at least 2-3 admin accounts
   - Different people, not just different accounts
   - Regular audit of admin accounts

4. **Set up monitoring:**
   - Alert when admin count drops below 2
   - Monitor emergency login usage
   - Log all admin role changes

### For Development

1. **Use dev admin login:**
   - Available in development mode at `/login`
   - "🔧 Test Login (Development Only)" button
   - Creates `dev@admin.com` automatically

2. **Use seed script:**
   ```bash
   npm run db:seed
   ```
   Creates test accounts including `admin@test.pl`

---

## Emergency Recovery Procedures

### Scenario 1: Forgot Admin Password (Another Admin Available)
1. Contact another admin
2. Have them reset your password at `/a/admin`
3. Login with new password

### Scenario 2: Only One Admin, Password Forgotten
1. Go to `/login`
2. Use emergency super admin credentials from `.env`
3. Click "🚨 Emergency Super Admin Login"
4. Once logged in, reset your original admin password

### Scenario 3: No Admins Exist (Zero Admin State)
1. Register a new account at `/register`
2. System automatically promotes to admin
3. Login and manage system

### Scenario 4: Login System Completely Broken
1. SSH into server
2. Run: `npm run create-emergency-admin`
3. Enter credentials or set via environment variables
4. Fix login system code
5. Login with emergency admin

### Scenario 5: Database Corruption
1. Restore database from backup
2. If backup doesn't have admins, use Scenario 3 or 4
3. Use super admin login to verify access
4. Investigate corruption cause

---

## Testing the System

### Test 1: Super Admin Login
```bash
# In .env
SUPER_ADMIN_EMAIL=test@superadmin.com
SUPER_ADMIN_PASSWORD=TestPass123!

# Navigate to /login and use emergency login button
```

### Test 2: Zero-Admin Promotion
```sql
-- Delete all admins from database
DELETE FROM users WHERE role = 'admin';

-- Register new account - should become admin automatically
```

### Test 3: CLI Emergency Tool
```bash
npm run create-emergency-admin
# Follow prompts
```

---

## Monitoring & Alerts

### Recommended Monitoring

**Alert when:**
- Admin count < 2
- Emergency super admin login used
- CLI emergency admin tool used
- Zero-admin auto-promotion triggers
- Admin account deleted

**Log Events:**
- All admin role changes
- Emergency access usage
- Failed emergency login attempts
- Admin password resets

---

## Best Practices

1. **Always maintain 2+ admins**
2. **Store super admin credentials securely**
3. **Regular security audits**
4. **Test recovery procedures quarterly**
5. **Document who has emergency access**
6. **Rotate super admin credentials annually**
7. **Monitor admin activity logs**
8. **Train staff on emergency procedures**

---

## Quick Reference

| Scenario | Solution | Access Level Required |
|----------|----------|----------------------|
| Forgot password (admins exist) | Layer 4: Admin reset | Another admin |
| Last admin locked out | Layer 1: Super admin | `.env` file access |
| No admins exist | Layer 2: Auto-promotion | None (public register) |
| Login broken | Layer 3: CLI tool | Server/database access |
| Fresh install | Layer 2: Auto-promotion | None (public register) |

---

## Files Modified

- `src/server/trpc/routers/auth.ts` - Added emergency login & zero-admin check
- `src/app/login/page.tsx` - Unified login with emergency and developer admin options
- `scripts/create-emergency-admin.ts` - CLI recovery tool
- `src/server/lib/admin-utils.ts` - Admin utility functions
- `package.json` - Added `create-emergency-admin` script

---

## Support

For additional help with admin account management:
1. Check this documentation
2. Review `/docs/user-guide` in the application
3. Contact system administrator
4. Review login logs at `/a/admin`
