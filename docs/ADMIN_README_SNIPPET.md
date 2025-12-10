# Admin Account Management

## Quick Setup

Add these to your `.env` file for emergency admin access:

```bash
# Emergency Super Admin Credentials
SUPER_ADMIN_EMAIL=emergency@yourcompany.com
SUPER_ADMIN_PASSWORD=YourSecurePassword123!
```

## Emergency Access

If you're locked out of admin accounts:

1. **Super Admin Login** (Recommended)
   - Go to `/login`
   - Enter super admin credentials from `.env`
   - System validates against environment variables

2. **CLI Tool** (Server access required)
   ```bash
   npm run create-emergency-admin
   ```

3. **Auto-Promotion** (No admins exist)
   - Register new account at `/register`
   - First user becomes admin automatically

## Documentation

- **Full Guide:** [`docs/ADMIN_ACCOUNT_MANAGEMENT.md`](./docs/ADMIN_ACCOUNT_MANAGEMENT.md)
- **Quick Reference:** [`docs/ADMIN_QUICKREF.md`](./docs/ADMIN_QUICKREF.md)
- **Implementation:** [`docs/ADMIN_IMPLEMENTATION_SUMMARY.md`](./docs/ADMIN_IMPLEMENTATION_SUMMARY.md)

## Security

⚠️ **CRITICAL:**
- Never commit `.env` to version control
- Store super admin credentials in password manager
- Maintain at least 2 active admin accounts
- Test emergency procedures quarterly

---

_This system provides 4 layers of protection against admin account lockouts._
