# Admin Account Management - Quick Reference

## 🚨 Emergency Access Methods

### 1. Super Admin Login (Recommended)
**Use when:** Admin password forgotten, all admins locked out
```
1. Go to /login
2. Enter super admin credentials from .env (SUPER_ADMIN_EMAIL/PASSWORD)
3. Click normal "Zaloguj się" button
4. System checks .env credentials automatically
```

### 2. Zero-Admin Auto-Promotion
**Use when:** No admins exist in system
```
1. Go to /register
2. Create new account
3. Automatically promoted to admin role
```

### 3. CLI Emergency Tool
**Use when:** Login system broken, need database access
```bash
npm run create-emergency-admin
# Follow prompts or set ADMIN_EMAIL/ADMIN_PASSWORD env vars
```

### 4. Another Admin Resets Password
**Use when:** At least one admin is logged in
```
1. Login as admin at /a/admin
2. Find user in user list
3. Click "Reset Password"
```

---

## 🔧 Setup Instructions

### Initial Setup (.env file)
```bash
# Add to your .env file
SUPER_ADMIN_EMAIL=emergency@yourcompany.com
SUPER_ADMIN_PASSWORD=<strong-password-here>
```

### Package.json Script
```json
{
  "scripts": {
    "create-emergency-admin": "tsx scripts/create-emergency-admin.ts"
  }
}
```

---

## ✅ Security Checklist

- [ ] Set SUPER_ADMIN_EMAIL in .env
- [ ] Set strong SUPER_ADMIN_PASSWORD in .env
- [ ] Store .env credentials in password manager
- [ ] Share emergency credentials with 2+ authorized people
- [ ] Never commit .env to version control
- [ ] Maintain at least 2 active admin accounts
- [ ] Test emergency procedures quarterly
- [ ] Monitor admin login logs regularly

---

## 📊 Decision Tree

```
Need admin access?
│
├─ Other admins available?
│  └─ YES → Use Layer 4 (Admin password reset)
│
├─ Have .env file access?
│  └─ YES → Use Layer 1 (Super admin login)
│
├─ Zero admins in database?
│  └─ YES → Use Layer 2 (Auto-promotion via /register)
│
└─ Have server/database access?
   └─ YES → Use Layer 3 (CLI emergency tool)
```

---

## 🔍 Troubleshooting

### Emergency login not working
- Check .env file has SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD
- Verify credentials match exactly (case-sensitive)
- Check application has restarted after .env changes
- Review browser console for errors

### CLI tool not working
- Verify DATABASE_URL in .env is correct
- Check database is running and accessible
- Ensure tsx is installed (`npm install tsx`)
- Run with verbose output: `DEBUG=* npm run create-emergency-admin`

### Auto-promotion not working
- Confirm truly zero admins: `SELECT * FROM users WHERE role = 'admin'`
- Check registration is not disabled
- Verify database connection is working
- Review application logs during registration

---

## 📞 Emergency Contacts

| Role | Contact | Access Level |
|------|---------|-------------|
| System Admin | [Add contact] | Full server access |
| Database Admin | [Add contact] | Database access |
| Super Admin Holder | [Add contact] | .env file access |

---

## 🔐 Credential Storage

**Store securely:**
1. Super admin credentials → Password manager (LastPass, 1Password, etc.)
2. Database credentials → Secrets manager (AWS Secrets Manager, Vault, etc.)
3. .env file → Encrypted storage, restricted access

**Never:**
- Commit to Git
- Share via email/chat
- Store in plain text on shared drives
- Use weak passwords

---

For detailed information, see [ADMIN_ACCOUNT_MANAGEMENT.md](./ADMIN_ACCOUNT_MANAGEMENT.md)
